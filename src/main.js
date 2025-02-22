const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const buildDir = `${basePath}/build`;
const layersDir = `${basePath}/layers`;
const { getRarityData } = require(`../utils/rarity.js`);

const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  numberOfItemsPerCategory
} = require(`${basePath}/src/config.js`);
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;
var metadataList = [];
var attributesList = [];
var dnaList = new Set();
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);

let hashlipsGiffer = null;

const buildSetup = () => {
  if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  fs.mkdirSync(`${buildDir}/json`);
  fs.mkdirSync(`${buildDir}/images`);
  if (gif.export) {
    fs.mkdirSync(`${buildDir}/gifs`);
  }
};

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

const cleanDna = (_str) => {
  const withoutOptions = removeQueryStrings(_str);
  var dna = Number(withoutOptions.split(":").shift());
  return dna;
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

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    elements: getElements(`${layersDir}/${layerObj.name}/`),
    name:
      layerObj.options?.["displayName"] != undefined
        ? layerObj.options?.["displayName"]
        : layerObj.name,
    blend:
      layerObj.options?.["blend"] != undefined
        ? layerObj.options?.["blend"]
        : "source-over",
    opacity:
      layerObj.options?.["opacity"] != undefined
        ? layerObj.options?.["opacity"]
        : 1,
    bypassDNA:
      layerObj.options?.["bypassDNA"] !== undefined
        ? layerObj.options?.["bypassDNA"]
        : false,
    itemsOptions: getItemsOptions(layerObj.options?.["itemsOptions"], layerObj.name)

  }));
  return layers;
};

const getItemsOptions = (itemsOptions, layerName) => {
  if (itemsOptions === undefined || itemsOptions.length <= 0){
    return []
  }

  const filteredOptions = itemsOptions.filter((option) => 
    option.name !== undefined && option.name.trim() !== ""
  )

  if (filteredOptions.length === 0) {
    return []
  }

  return filteredOptions.map((itemOptions) => ({
    name: itemOptions.name,
    blend: itemOptions.blend != undefined && itemOptions.blend.trim() !== ""
      ? itemOptions.blend
      : "source-over",
    opacity: itemOptions.opacity != undefined
      ? itemOptions.opacity
      : 1,
  }))
}

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition) => {
  let dateTime = Date.now();
  let tempMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList
  };
  if (network == NETWORK.sol) {
    tempMetadata = {
      //Added metadata for solana
      name: tempMetadata.name,
      symbol: solanaMetadata.symbol,
      description: tempMetadata.description,
      //Added metadata for solana
      seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
      image: `${_edition}.png`,
      //Added metadata for solana
      external_url: solanaMetadata.external_url,
      edition: _edition,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      properties: {
        files: [
          {
            uri: `${_edition}.png`,
            type: "image/png",
          },
        ],
        category: "image",
        creators: solanaMetadata.creators,
      },
    };
  }

  metadataList.push(tempMetadata);
  attributesList = [];
};

const addAttributes = (_element, extractOnlyMouth) => {
  let selectedElement = _element.layer.selectedElement;

  if (_element.layer.name.trim().toLowerCase() === "body") {
    const selectedElementNameParts = selectedElement.name.split("with")
      const bodyType = selectedElementNameParts[0].trim() 
      const mouthType = selectedElementNameParts[1].trim() 
  
    if (extractOnlyMouth === true) {
      attributesList.push({
        trait_type: "Mouth",
        value: mouthType,
      });
    } else {
      attributesList.push({
        trait_type: _element.layer.name,
        value: bodyType,
      });
      
      attributesList.push({
        trait_type: "Mouth",
        value: mouthType,
      });
    }
  } else {
    attributesList.push({
      trait_type: _element.layer.name,
      value: selectedElement.name,
    });
  }
};

const loadLayerImg = async (_layer) => {
  try {
    return new Promise(async (resolve) => {
      const image = await loadImage(`${_layer.selectedElement.path}`);
      resolve({ layer: _layer, loadedImage: image });
    });
  } catch (error) {
    console.error("Error loading image:", error);
  }
};

const addText = (_sig, x, y, size) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

const drawElement = (_renderObject, _index, _layersLen) => {
  const optionsForSelectedElement = _renderObject.layer.itemsOptions.find(
    (itemOptions) => itemOptions.name === _renderObject.layer.selectedElement.name
  )

  if (optionsForSelectedElement !== undefined) {
    ctx.globalCompositeOperation = optionsForSelectedElement.blend
    ctx.globalAlpha = optionsForSelectedElement.opacity
  } else {
    ctx.globalCompositeOperation = _renderObject.layer.blend;
    ctx.globalAlpha = _renderObject.layer.opacity;
  }

  text.only
    ? addText(
        `${_renderObject.layer.name}${text.spacer}${_renderObject.layer.selectedElement.name}`,
        text.xGap,
        text.yGap * (_index + 1),
        text.size
      )
    : ctx.drawImage(
        _renderObject.loadedImage,
        0,
        0,
        format.width,
        format.height
      );

  addAttributes(_renderObject);
};

const constructLayerToDna = (_dna = "", _layers = [], step) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
    );
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement: selectedElement,
      itemsOptions: layer.itemsOptions
    };
  });
  return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const dnaItems = _dna.split(DNA_DELIMITER);
  const filteredDNA = dnaItems.filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true;
    }
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA;
  });

  return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const createDna = (_layers, layerToSkip = 'Body') => { 
  let randNum = [];
  let bodyName = ''; // this is custom for my needs
  _layers.forEach((layer) => {
    if (layer.name.toLowerCase() === 'ears') {
      return;
    }
    var totalWeight = 0;
    layer.elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= layer.elements[i].weight;
      if (random < 0) {

        let chosenElement = layer.elements[i]

        if (layer.name.toLowerCase() === 'body') { // this is custom for my needs
           bodyName = chosenElement.filename
        }

        return randNum.push(
          `${chosenElement.id}:${chosenElement.filename}${
            layer.bypassDNA ? "?bypassDNA=true" : ""
          }`
        );
      }
    }
  });

  return randNum.join(DNA_DELIMITER);
};

const isInRange = (number, category) => {
  return number > 0 && number <= getRange(category)
}

const getRange = (category) => {
  switch (category) {
    case 'mythic': {
      return 0 + numberOfItemsPerCategory.mythic
    }
    case 'legendary': {
      return 0 + numberOfItemsPerCategory.mythic + numberOfItemsPerCategory.legendary
    }
    case 'epic': {
      return 0 + 
        numberOfItemsPerCategory.mythic + 
        numberOfItemsPerCategory.legendary +
        numberOfItemsPerCategory.epic
    }
    case 'rare': {
      return 0 + 
        numberOfItemsPerCategory.mythic + 
        numberOfItemsPerCategory.legendary +
        numberOfItemsPerCategory.epic +
        numberOfItemsPerCategory.rare
    }
    case 'common': {
      return 0 + 
        numberOfItemsPerCategory.mythic + 
        numberOfItemsPerCategory.legendary +
        numberOfItemsPerCategory.epic +
        numberOfItemsPerCategory.rare +
        numberOfItemsPerCategory.common
    }
  }
}

const addBodyAndEarsToDna = (_bodyAndEarslayers, dnaWithoutBodyAndEars, rarityIndex) => {
  let bodyLayerIndex = layerConfigurations[0].layersOrder.findIndex((el) => el.name === 'Body')
  let earsLayerIndex = layerConfigurations[0].layersOrder.findIndex((el) => el.name === 'Ears')

  let bodyAndEarsDnaArr = [];
  let bodyName = ''; // this is custom for my needs
  let oldDna = dnaWithoutBodyAndEars.split(DNA_DELIMITER)

  let chosenMouth = oldDna[bodyLayerIndex].split(' with ')[1].toLowerCase()
  _bodyAndEarslayers.forEach((layer) => {

    if (layer.name.toLowerCase() === 'body') { // this is custom for my needs
      let bodyElementsToSelectFrom = []
      if (isInRange(rarityIndex + 1, 'mythic')) { 
        bodyElementsToSelectFrom = layer.elements.filter((el) => el.filename.split(' ')[0].toLowerCase() === 'golden')
      } else if (isInRange(rarityIndex + 1, 'legendary')){
        bodyElementsToSelectFrom = layer.elements.filter((el) => el.filename.split(' ')[0].toLowerCase() === 'shine')
      } else if (isInRange(rarityIndex + 1, 'epic')){
        bodyElementsToSelectFrom = layer.elements.filter((el) => el.filename.split(' ')[0].toLowerCase() === 'rainbow')
      } else if (isInRange(rarityIndex + 1, 'rare')){
        bodyElementsToSelectFrom = layer.elements.filter((el) => el.filename.split(' ')[0].toLowerCase() === 'darker')
      } else if (isInRange(rarityIndex + 1, 'common')){
        bodyElementsToSelectFrom = layer.elements.filter((el) => el.filename.split(' ')[0].toLowerCase() === 'normal')
      }

      console.log('chosen mouth', chosenMouth)
      console.log('chosen element', bodyElementsToSelectFrom.find((el) => el.filename.toLowerCase().includes(chosenMouth)))
      let chosenElement = bodyElementsToSelectFrom.find((el) => el.filename.toLowerCase().includes(chosenMouth))

      bodyName = chosenElement.filename

      return bodyAndEarsDnaArr.push(
        `${chosenElement.id}:${chosenElement.filename}${
          layer.bypassDNA ? "?bypassDNA=true" : ""
        }`
      );


      // var totalBodyWeight = 0;
      // // console.log('golden', goldeneBodyElements)

      // bodyElementsToSelectFrom.forEach((element) => {
      //   totalBodyWeight += element.weight;
      // });

      // // number between 0 - totalBodyWeight
      // let random = Math.floor(Math.random() * totalBodyWeight);
      // for (var i = 0; i < bodyElementsToSelectFrom.length; i++) {
      //   random -= bodyElementsToSelectFrom[i].weight;
      //   if (random < 0) {

      //     let chosenElement = bodyElementsToSelectFrom[i]

      //     bodyName = chosenElement.filename

      //     return bodyAndEarsDnaArr.push(
      //       `${chosenElement.id}:${chosenElement.filename}${
      //         layer.bypassDNA ? "?bypassDNA=true" : ""
      //       }`
      //     );
      //   }
      // }
    } 
    if (layer.name.toLowerCase() === 'ears') {
      /// to trza wydzielic w ciul
      var totalWeight = 0;
      layer.elements.forEach((element) => {
        totalWeight += element.weight;
      });
      // number between 0 - totalWeight
      let random = Math.floor(Math.random() * totalWeight);
      for (var i = 0; i < layer.elements.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        random -= layer.elements[i].weight;
        if (random < 0) {
          let chosenElement = layer.elements[i]
          chosenElement = getCorrectEars(layer, bodyName, chosenElement)

          return bodyAndEarsDnaArr.push(
            `${chosenElement.id}:${chosenElement.filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    }   
  });
  let body = bodyAndEarsDnaArr[0]
  let ears = bodyAndEarsDnaArr[1]
  oldDna.splice(bodyLayerIndex, 1, body)
  oldDna.splice(earsLayerIndex, 0, ears)

  let completeDna = oldDna.join(DNA_DELIMITER)
  
  return completeDna
};

const getCorrectEars = (layer, bodyName, currentEars) => { // this is custom for my needs
  let earsNameParts = currentEars.filename.split('#')[0].split(' ')
  let earsSize = earsNameParts[0]
  let earsType = earsNameParts[1] ?? 'normal'

  if (bodyName !== '') {
    let bodyType = bodyName.split(' ')[0]

    switch (bodyType.toLowerCase()) {
      case 'normal':
      case 'darker': {
        const expectedType = 'normal'
        if (earsType.toLowerCase() === expectedType) return currentEars;

        return layer.elements.find((el) => {
          return el.filename === `${earsSize}${rarityDelimiter}${currentEars.weight}.png` 
        });
      }
      case 'golden': {
        const expectedType = 'golden'
        if (earsType.toLowerCase() === expectedType) return currentEars;

        return layer.elements.find((el) => {
          return el.filename === `${earsSize} ${expectedType}${rarityDelimiter}${currentEars.weight}.png` 
        });
      }
      case 'rainbow': {
        const expectedType = 'rainbow'
        if (earsType.toLowerCase() === expectedType) return currentEars;

        return layer.elements.find((el) => {
          return el.filename === `${earsSize} ${expectedType}${rarityDelimiter}${currentEars.weight}.png` 
        })
      }
      case 'shine': {
        const expectedType = 'shine'
        if (earsType.toLowerCase() === expectedType) return currentEars;

        return layer.elements.find((el) => {
          return el.filename === `${earsSize} ${expectedType}${rarityDelimiter}${currentEars.weight}.png` 
        })
      }
      default: {
        return currentEars
      }
    }
  }

  return currentEars
}

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
};

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs
    ? console.log(
        `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
      )
    : null;
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}





const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  let layersWithDna = []
  
  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  if (shuffleLayerConfigurations) { 
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  console.log("Editions left to create: ", abstractedIndexes)
  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder.filter((layer) => layer.name !== "Ears")
    );
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers, 'Body');
      if (isDnaUnique(dnaList, newDna)) {
        layersWithDna.push({
          encodedDna: sha1(newDna), 
          dna: newDna, 
          layers: layers
        })

        let results = constructLayerToDna(newDna, layers, 1);
        let loadedElements = [];

        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then((renderObjectArray) => {
          renderObjectArray.forEach((renderObject, index) => {
            addAttributes(renderObject, true)
          });
        });
        addMetadata(newDna, abstractedIndexes[0]);


        console.log(
          `Created first metadata for edition: ${abstractedIndexes[0]}, with DNA: ${sha1(
            newDna
          )}`
        );

        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));



  // Getting generated nfts sorted by they rarity score so that we can pick body by rarity
  let raritySorted = getRarityData(true)
 
  layerConfigIndex = 0
  editionCount = 0
  abstractedIndexes = []
  metadataList = []
  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }

  abstractedIndexes = shuffle(abstractedIndexes);

  while (layerConfigIndex < layerConfigurations.length) {
    const bodyAndEarslayers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder.filter((layer) => layer.name === "Body" || layer.name === "Ears")
    );
    const allLayers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder
    );
    while (
      editionCount < raritySorted.length
    ) {
      let oldDna = layersWithDna.find((layerWithDna) => layerWithDna.encodedDna === raritySorted[editionCount].dna).dna

      let newDna = addBodyAndEarsToDna(bodyAndEarslayers, oldDna, editionCount);
      if (isDnaUnique(dnaList, newDna)) {
        let results = constructLayerToDna(newDna, allLayers, 2);
        let loadedElements = [];

        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then((renderObjectArray) => {
          debugLogs ? console.log("Clearing canvas") : null;
          ctx.clearRect(0, 0, format.width, format.height);
          if (gif.export) {
            hashlipsGiffer = new HashlipsGiffer(
              canvas,
              ctx,
              `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
              gif.repeat,
              gif.quality,
              gif.delay
            );
            hashlipsGiffer.start();
          }
          if (background.generate) {
            drawBackground();
          }
          renderObjectArray.forEach((renderObject, index) => {
            drawElement(
              renderObject,
              index,
              layerConfigurations[layerConfigIndex].layersOrder.length
            );
            if (gif.export) {
              hashlipsGiffer.add();
            }
          });
          if (gif.export) {
            hashlipsGiffer.stop();
          }
          debugLogs
            ? console.log("Editions left to create: ", abstractedIndexes)
            : null;
          saveImage(abstractedIndexes[0]);
          addMetadata(newDna, abstractedIndexes[0]);
          saveMetaDataSingleFile(abstractedIndexes[0]);
          console.log(
            `Created edition: ${abstractedIndexes[0]}, with DNA: ${sha1(
              newDna
            )}`
          );
        });
        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
};

module.exports = { startCreating, buildSetup, getElements };
