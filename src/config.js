const basePath = process.cwd();
const { MODE } = require(`${basePath}/constants/blend_mode.js`);
const { NETWORK } = require(`${basePath}/constants/network.js`);

const network = NETWORK.eth;

// General metadata for Ethereum
const namePrefix = "PlayNity Genesis";
const description = "PlayNity Genesis Collection";
const baseUri = "ipfs://NewUriToReplace";

const solanaMetadata = {
  symbol: "PNG",
  seller_fee_basis_points: 350, // Define how much % you want from secondary market sales 1000 = 10%
  external_url: "https://app.mintdao.io",
  creators: [
    {
      address: "",
      share: 0,
    },
  ],
};

// If you have selected Solana then the collection starts from 0 automatically
// You can now add extra options to each layer
// you can specify blend mode and opacity for whole layer and display name, like so:
// options: { blend: MODE.luminosity, opacity: 0.5, displayName: "my fav layer <3" }

// but you can also specify blend mode and opacity for a specific element from the layer, like so:
// options: { itemsOptions: [{ name: "Scars", blend: MODE.luminosity, opacity: 0.5 }] }
// these options will only apply to the element called "Scars". You can specify different options 
// for mulitple elements from the same layer
const layerConfigurations = [
  {
    growEditionSizeTo: 1800,
    layersOrder: [
      { name: "Background" },
      { name: "Body" },
      { name: "Hair" },
      { name: "Ears" },
      { name: "Clothes" },
      { name: "Face Details",
        options: {
          itemsOptions: [{
            name: 'Scars',
            blend: MODE.luminosity,
            opacity: 0.9
          }]
        } 
      },
      { name: "Eyebrows" },
      { name: "Eyes" },
      { name: "Jewelry" },
      { name: "Headwear" },
      { name: "Glasses" },
      { name: "Head Features" }
    ],
  },
];

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  width: 3150,
  height: 3150,
  smoothing: false,
};

const gif = {
  export: false,
  repeat: 0,
  quality: 10,
  delay: 500,
};

const text = {
  only: false,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 512,
};

const background = {
  generate: true,
  brightness: "80%",
  static: false,
  default: "#000000",
};

const extraMetadata = {};

const rarityDelimiter = "#";

const uniqueDnaTorrance = 10000;

const preview = {
  thumbPerRow: 80,
  thumbWidth: 200,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  preview_gif,
};
