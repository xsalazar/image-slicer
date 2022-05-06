const sharp = require("sharp");
const util = require("util");
const imageToSlices = require("image-to-slices");

exports.handler = async (event, context) => {
  console.log(JSON.stringify(event));

  var errorReturnResponse = {
    cookies: [],
    isBase64Encoded: false,
    statusCode: 400,
    headers: {},
    body: "",
  };

  if (event.body) {
    const fileLocation = "/tmp/tmp.png";

    console.log(event.body);

    // Take input data and resize it to be 7 64-px emojis wide
    await sharp(Buffer.from(event.body, "base64"))
      .resize(64 * 7)
      .toFile(fileLocation);

    console.log("Successfully resized and saved!");

    const metadata = await sharp(fileLocation).metadata();

    const xSlices = [64, 128, 192, 256, 320, 384, 448];
    const ySlices = [];

    for (var j = 64; j < metadata.height; j += 64) {
      ySlices.push(j);
    }

    var returnList;

    const imageToSlicesPromise = util.promisify(imageToSlices);

    const dataUrlList = await imageToSlicesPromise(
      fileLocation,
      xSlices,
      ySlices,
      {
        saveToDataUrl: true,
        clipperOptions: {
          canvas: require("canvas"),
        },
      }
    );

    console.log(dataUrlList);
    returnList = dataUrlList.map((x) => x.dataURI);
    console.log(returnList);

    return {
      cookies: [],
      isBase64Encoded: true,
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: returnList,
    };
  }
};
