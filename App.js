require('dotenv').config()
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const Twit = require('twit');
const imageToBase64 = require('image-to-base64');

const tweet = new Twit({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  timeout_ms: 60 * 1000,
  strictSSL: true,
});

(async () => {
  const response = await fetch("https://www.la-spa.fr/adopter-animaux?field_esp_ce_value=2&field_race_value=&_field_localisation=refuge&field_departement_refuge_tid=All&field_sexe_value=All&field_taille_value=All&title_1=&field_sauvetage_value=All&_field_age_value=&_field_adresse=", {
    "method": "GET",
  })
  const $ = cheerio.load(await response.text())
  const dogs = $(".block-result-search").map((index, element) => {
    const dogData = $(element).find('.refuge-name > a:nth-child(2)')
      .text()
      .split(' - ');
    return {
      dogName: $(element)
        .find('span.animal-name > h3 > a')
        .text()
        .split(' ', 1)
        .toString(),

      dogImg: $(element).find('.field-item > img').attr('src'),
      dogDep: dogData[0],
      dogRef: dogData[1],
      dogCity: dogData[2] != null ? dogData[2] : 'Inconnue',
      dogLink: `https://www.la-spa.fr${$(element).find('span.animal-name > h3 > a').attr('href')}`
    }
  }).get();

  let client = await MongoClient.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`)
  let db = client.db("spa_bot");
  try {
    for (const dog of dogs) {
      const res = await db.collection("dogs").findOne(dog);
      if (res === null) {
        console.log(`${dog.dogName} added 😔`);
        await db.collection('dogs').insertOne(dog)
        const img64 = await imageToBase64(dog.dogImg);
        console.log('making a tweet');
        const media = await tweet.post('media/upload', {
          media_data: img64
        });
        const mediaIdStr = media.data.media_id_string;
        const tweetResponse = await tweet.post('statuses/update', {
          status: 'test',
          media_ids: [mediaIdStr]
        });
        console.log('made a tweet');
      } else {
        console.log('🐕 No dogs added 🐕');
      }
    }
  } finally {
    client.close();
  };
})();