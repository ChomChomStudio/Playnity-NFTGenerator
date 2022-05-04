const basePath = process.cwd();
const fs = require("fs");
const layersDir = `${basePath}/layers`;

const { layerConfigurations, rarityDelimiter } = require(`${basePath}/src/config.js`);

// const { getElements } = require("../src/main.js");


const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = Number(
    nameWithoutExtension.split(rarityDelimiter).pop()
  );
  if (isNaN(nameWithoutWeight)) {
    nameWithoutWeight = 1;
  }
  return nameWithoutWeight;
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (path) => {
  return fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      if (i.includes("-")) {
        throw new Error(`layer name can not contain dashes, please fix: ${i}`);
      }
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i),
      };
    });
};

const getRarityData = function(toPrint) {
  // read json data
  let rawdata = fs.readFileSync(`${basePath}/build/json/_metadata.json`);
  let data = JSON.parse(rawdata);
  let editionSize = data.length;
  // console.log(data)
  let rarityData = [];

  // intialize layers to chart
  layerConfigurations.forEach((config) => {
    let layers = config.layersOrder;

    layers.forEach((layer) => {
      // get elements for each layer
      let elementsForBodyLayer = [];
      let elementsForMouthLayer = [];
      let elements = getElements(`${layersDir}/${layer.name}/`);

      // If layer is body we neeed to split each element into Body and Mouth attributes
      // because the are currently combined as one PNG file because of technical issues
      if (layer.name === "Body") {
        elements.forEach((element) => {
          let bodyTrait = element.name.split('with')[0].trim()
          let bodyRarityDataElement = {
            trait: bodyTrait,
            weight: element.weight.toFixed(0),
            occurrence: 0, // initialize at 0
            chance: 0.0
          };

          let mouthTrait = element.name.split('with')[1].trim()
          let mouthRarityDataElement = {
            trait: mouthTrait,
            weight: element.weight.toFixed(0),
            occurrence: 0, // initialize at 0
            chance: 0.0
          };

          if (!elementsForBodyLayer.filter(e => e.trait === bodyTrait).length > 0) {
            elementsForBodyLayer.push(bodyRarityDataElement);
          }
          if (!elementsForMouthLayer.filter(e => e.trait === mouthTrait).length > 0) {
            elementsForMouthLayer.push(mouthRarityDataElement);
          }
        });
        
        let bodyLayerName = "Body"
        let mouthLayerName = "Mouth"
        // don't include duplicate layers
        if (!rarityData.includes(bodyLayerName)) {
          // add elements for each layer to chart
          rarityData[bodyLayerName] = elementsForBodyLayer;
        }
        if (!rarityData.includes(mouthLayerName)) {
          rarityData[mouthLayerName] = elementsForMouthLayer;
        }

      // if layer is not Body we can continue the old way
      } else {
        let elementsForLayer = []
        elements.forEach((element) => {
          // just get name and weight for each element
          let rarityDataElement = {
            trait: element.name,
            weight: element.weight.toFixed(0),
            occurrence: 0, // initialize at 0
            chance: 0.0
          };

          rarityDataElement = {
            trait: element.name,
            weight: element.weight.toFixed(0),
            occurrence: 0, // initialize at 0
            chance: 0.0
          };
          elementsForLayer.push(rarityDataElement);
        });
        let layerName =
          layer.options?.["displayName"] != undefined
            ? layer.options?.["displayName"]
            : layer.name;
        // don't include duplicate layers
        if (!rarityData.includes(layer.name)) {
          // add elements for each layer to chart
          rarityData[layerName] = elementsForLayer;
        }
      }


    });
  });


  // fill up rarity chart with occurrences from metadata
  data.forEach((element, index) => {
    let attributes = element.attributes;
    attributes.forEach((attribute) => {
      let traitType = attribute.trait_type;
      let value = attribute.value;

      let rarityDataTraits = rarityData[traitType];
      rarityDataTraits?.forEach((rarityDataTrait) => {
        if (rarityDataTrait.trait == value) {
          // keep track of occurrences
          rarityDataTrait.occurrence++;
        }
      });
    });
  });

  // convert occurrences to occurence string
  for (var layer in rarityData) {
    for (var attribute in rarityData[layer]) {
      // get chance
      let chance =
        ((rarityData[layer][attribute].occurrence / editionSize) * 100).toFixed(2);

        rarityData[layer][attribute].chance = chance

      // show two decimal places in percent
      rarityData[layer][attribute].occurrence =
        `${rarityData[layer][attribute].occurrence} in ${editionSize} editions (${chance} %)`;
    }
  }

  // // calculate rarity score
  data.forEach((element, index) => {
    // console.log(element)
    let attributes = element.attributes;
    let rarityScore = 0

    attributes.forEach((attribute) => {
      let traitType = attribute.trait_type;
      let value = attribute.value;

      let rarityDataTraits = rarityData[traitType].find((e) => e.trait === value);
      let chance = 1 / (rarityDataTraits.chance / 100)
      attribute["chance"] = rarityDataTraits.chance
      rarityScore += chance
    });


    element["rarityScore"] = rarityScore
  });

  let sorted = data.sort((a,b) => b.rarityScore - a.rarityScore)

  if (toPrint === true) {
    // print out rarity data
    console.log('\x1b[33m%s\x1b[0m', "############################################")
    console.log('\x1b[33m%s\x1b[0m', "############################################")
    console.log('\x1b[33m%s\x1b[0m', "############--TRAITS RARITY DATA--##########")
    console.log('\x1b[33m%s\x1b[0m', "############--TRAITS RARITY DATA--##########")
    console.log('\x1b[33m%s\x1b[0m', "############################################")
    console.log('\x1b[33m%s\x1b[0m', "############################################")
    for (var layer in rarityData) {
      console.log(`Trait type: ${layer}`);
      for (var trait in rarityData[layer]) {
        console.log(rarityData[layer][trait]);
      }
      console.log();
    }

    console.log('\x1b[33m%s\x1b[0m', "#################################################")
    console.log('\x1b[33m%s\x1b[0m', "#################################################")
    console.log('\x1b[33m%s\x1b[0m', "############--NFT'S RARITY SCORE DATA--##########")
    console.log('\x1b[33m%s\x1b[0m', "############--NFT'S RARITY SCORE DATA--##########")
    console.log('\x1b[33m%s\x1b[0m', "#################################################")
    console.log('\x1b[33m%s\x1b[0m', "#################################################")
    sorted.forEach((el, index) => {
      console.log("INDEX: ", index)
      console.log(`Name: ${el.name}`);
      console.log(`Rarity Score: ${el.rarityScore}`)
      console.log('Attributes:')
      console.log(el.attributes)
      console.log();
    })
  }

  return sorted
}
module.exports = { getRarityData }