require("dotenv").config();
const fetch = require("node-fetch");
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const twit = require("twitter-api-v2");
const imageToBase64 = require("image-to-base64");
const strip = require("string-strip-html");

const tweet = new twit.TwitterApi({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true,
});

const fetchDogs = async () => {
  const response = await fetch(
    "https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/?api=1&species=chien&paged=1&seed=574726291398023"
  );
  const jsonResponse = await response.json();
  const dogsData = jsonResponse.results;
  const dogs = dogsData.map((dog) => {
    let rawDescription = dog.description;
    if (rawDescription != null) {
      rawDescription = strip.stripHtml(dog?.description).result;
    }
    const description =
      rawDescription?.length == undefined
        ? null
        : rawDescription.substring(0, 210);
    return {
      name: dog.name,
      image: dog.image,
      description: dog.description,
      age: dog.age_number,
      races_label: dog.races_label,
      establishment: dog.establishment.name,
      url: dog.full_url,
      description: description,
    };
  });
  return dogs;
};

(async () => {
  const dogs = await fetchDogs();
  const client = await MongoClient.connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`,
    { useUnifiedTopology: true }
  );
  const db = client.db("spa_bot");
  let manualText;
  try {
    for (const dog of dogs) {
      const res = await db.collection("dogs").findOne(dog);
      if (res === null) {
        console.log(`${dog.name} added to database 😔`);
        await db.collection("dogs").insertOne(dog);
        const img64 = await imageToBase64(dog.image);
        console.log("making a tweet");
        const media = await tweet.post("media/upload", {
          media_data: img64,
        });
        const mediaIdStr = media.data.media_id_string;
        if (dog.races_label !== undefined) {
          manualText = `${dog.name} est un chien de type ${dog.races_label}, ${dog.name} attend patiemment sa nouvelle famille au ${dog.establishment}. En savoir plus ${dog.url} #LaVieQuilsMéritent`;
        } else {
          manualText = `${dog.name} attend patiemment sa nouvelle famille au ${dog.establishment}. En savoir plus ${dog.url} #LaVieQuilsMéritent`;
        }
        const tweetTextScrapped = `${dog.description}... En savoir plus : ${dog.url} #LaVieQuilsMéritent`;
        const status = dog.description ? tweetTextScrapped : manualText;
        await tweet.post("statuses/update", {
          status: status,
          media_ids: [mediaIdStr],
        });
      } else {
        console.log("🐕 Dog already known 🐕");
      }
    }
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
})();
