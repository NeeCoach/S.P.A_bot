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


const getRandomArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

(async () => {
  try {
    const response = await fetch("https://www.la-spa.fr/adopter-animaux?field_esp_ce_value=2&field_race_value=&_field_localisation=refuge&field_departement_refuge_tid=All&field_sexe_value=All&field_taille_value=All&title_1=&field_sauvetage_value=All&_field_age_value=&_field_adresse=", {
      "method": "GET",
    })
    const $ = cheerio.load(await response.text())
    const dogs = $(".block-result-search").map(async (index, element) => {
      const dogData = $(element).find('.refuge-name > a:nth-child(2)')
        .text()
        .split(' - ');
      const dogLink = `https://www.la-spa.fr${$(element).find('span.animal-name > h3 > a').attr('href')}`
      const dogName = $(element).find('span.animal-name > h3 > a')
        .text()
        .split(' ', 1)
        .toString();
      const dogImg = $(element).find('.field-item > img').attr('src');
      const dogDep = dogData[0];
      const dogRef = dogData[1];
      const dogCity = dogData[2] != null ? dogData[2] : 'Non renseignée';
      let dogRace;
      let dogDesc;
      const getOneDogresponse = await fetch(dogLink, {
        "method": "GET",
      })
      const $d = cheerio.load(await getOneDogresponse.text())
      $d('.content.col-xs-12.col-sm-8.left-bar.dog').map((index, element) => {
        dogRace = $d(element).find('.field-name-field-race > div:nth-child(2)').first().text();
        if (dogRace.match(/\(([^)]*)\)/)) dogRace = /\(([^)]*)\)/.exec(dogRace)[1]
        dogDesc = $d(element).find('.field-type-text-with-summary > div > div').text();
        dogDesc = dogDesc.length == 0 ? null : dogDesc.substring(0, 210);
      }).get();
      return {
        dogName: dogName,
        dogImg: dogImg,
        dogDep: dogDep,
        dogRef: dogRef,
        dogCity: dogCity,
        dogLink: dogLink,
        dogRace: dogRace,
        dogDesc: dogDesc
      }
    }).get();
    let client = await MongoClient.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}`)
    let db = client.db("spa_bot");
    try {
      for await (const dog of dogs) {
        const res = await db.collection("dogs").findOne(dog);
        if (res === null) {
          console.log(`${dog.dogName} added to database 😔`);
          await db.collection('dogs').insertOne(dog)
          const img64 = await imageToBase64(dog.dogImg);
          console.log('making a tweet');
          const media = await tweet.post('media/upload', {
            media_data: img64
          });
          const mediaIdStr = media.data.media_id_string;
          const tweetTextManual = `${dog.dogName} est un chien de race ${dog.dogRace}, ${dog.dogName} attend patiemment sa nouvelle famille au ${dog.dogRef} dans le département ${dog.dogDep}. En savoir plus ${dog.dogLink} @SPA_Officiel #Chien`
          const tweetTextScrapped = `${dog.dogDesc}... En savoir plus : ${dog.dogLink} @SPA_Officiel #Chien`
          const status = dog.dogDesc ? tweetTextScrapped : tweetTextManual;
          const tweetResponse = await tweet.post('statuses/update', {
            status: status,
            media_ids: [mediaIdStr]
          });
        } else {
          console.log('🐕 Dog already know 🐕');
        }
      }
    } finally {
      client.close();
    };
  } catch (error) {
    console.log(error);
  }
})();


const twitter_account = [
  '@SPA_Officiel',
  '@30millionsdamis',
];