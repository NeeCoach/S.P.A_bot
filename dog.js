const fetch = require('node-fetch');
const cheerio = require('cheerio');


( async () =>{

  const getOneDogresponse = await fetch("https://www.la-spa.fr/adopter-animaux/adopter-chien-croise-autre-berger-f-penny-477724", {
    "method": "GET",
  })
  const $d = cheerio.load(await getOneDogresponse.text())
  $d('.content.col-xs-12.col-sm-8.left-bar.dog').map((index, element)=>{
    const dogRace = $d(element).find('.field-name-field-race > div:nth-child(2)').first().text();
    const dogDesc = $d(element).find('.field-type-text-with-summary > div > div').text();
    dogDesc.length == 0 ? console.log('no desc') : console.log(dogDesc);
    console.log(dogRace);
  })
})();