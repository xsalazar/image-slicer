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

    // Take input data and resize it to be 7 64-px emojis wide, then grab resulting height
    const height = (
      await sharp(Buffer.from(event.body, "base64"))
        .resize(64 * 7)
        .toFile(fileLocation)
    ).height;

    // If resulting image height isn't divisible by 64, pad the bottom so it is
    if (height % 64 !== 0) {
      console.log(`Height: ${height}`);
      console.log(`height % 64: ${height % 64} pixles over`);
      console.log(`64 - (height % 64): ${64 - (height % 64)} to add`);
      const buffer = await sharp(fileLocation)
        .extend({
          bottom: 64 - (height % 64),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer();

      await sharp(buffer).toFile(fileLocation);
    }

    const ySlices = [64, 128, 192, 256, 320, 384, 448];

    const maxXSlices = Math.floor(height / 64);
    const xSlices = Array.from({ length: maxXSlices }, (_, i) => 64 + i * 64);

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
      isBase64Encoded: false,
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(returnList),
    };
  }
};
