const fetch = require('node-fetch');
const cheerio = require('cheerio');


(async() => {
  const response = fetch("https://www.la-spa.fr/adopter-animaux?field_esp_ce_value=2&field_race_value=&_field_localisation=refuge&field_departement_refuge_tid=All&field_sexe_value=All&field_taille_value=All&title_1=&field_sauvetage_value=All&_field_age_value=&_field_adresse=", {
    "headers": {
      "cookie": "has_js=1; Drupal.visitor.latitude=48.8582; Drupal.visitor.longitude=2.3387"
    },
    "method": "GET",
  }).then(response => response.text());
  const $ = cheerio.load(await response)
  const dogs = $(".block-result-search").map((index, element) => {
    const dogData = $(element).find('.refuge-name > a:nth-child(2)').text().split(' - ');
    return {
      dogName: $(element).find('span.animal-name > h3 > a').text().split(' ',1).toString(),
      dogImg: $(element).find('.field-item > img').attr('src'),
      dogDep: dogData[0],
      dogRef: dogData[1],
      dogCity: dogData[2] != null ? dogData[2]: 'Inconnue',
      dogLink: `https://www.la-spa.fr${$(element).find('span.animal-name > h3 > a').attr('href')}`
    } 
  });
})();
