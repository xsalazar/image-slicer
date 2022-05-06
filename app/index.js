const sharp = require("sharp");
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

    // Take input data and resize it to be 7 64-px emojis wide
    await sharp(Buffer.from(event.body, "base64"))
      .resize(64 * 7)
      .toFile(fileLocation);

    const metadata = await sharp(fileLocation).metadata();

    const xSlices = [64, 128, 192, 256, 320, 384, 448];
    const ySlices = [];

    for (var j = 64; j < metadata.height; j += 64) {
      ySlices.push(j);
    }

    var returnList;

    imageToSlices(
      fileLocation,
      xSlices,
      ySlices,
      {
        saveToDataUrl: true,
        clipperOptions: {
          canvas: require("canvas"),
        },
      },
      function (dataUrlList) {
        returnList = dataUrlList.map((x) => x.dataURI);
      }
    );

    while (!returnList) {
      await new Promise((r) => setTimeout(r, 250));
    }

    return {
      cookies: [],
      isBase64Encoded: true,
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(returnList),
    };
  }
};
