const sharp = require("sharp");
const imageToSlices = require("image-to-slices");
const { v4: uuidv4 } = require("uuid");

// Slack uses JUMBOMOJI for less than 23 emoji in one message, so we'll have either a (4x5) or a (5x4) mosaic
// This requires padding either the bottom or the right hand side of the image, depending on which original dimension is longer to preserve landscape vs. portrait
exports.handler = async (event, context) => {
  console.log(JSON.stringify(event));

  if (event.body) {
    try {
      // Return variables
      var returnList;
      var isLandcape = false;

      const fileLocation = `/tmp/${uuidv4()}.png`;
      const originalImage = sharp(Buffer.from(event.body, "base64"));
      const originalHeight = (await originalImage.metadata()).height;
      const originalWidth = (await originalImage.metadata()).width;

      // If the original image is taller than it is wider (portrait), make the longer dimension 5 emoji long
      if (originalHeight > originalWidth) {
        const resizedWidth = (
          await originalImage
            .resize(
              null, // width
              64 * 5 // height
            )
            .toFile(fileLocation)
        ).width;

        // If resulting image width isn't divisible by 64, pad the right side so it is
        if (resizedWidth % 64 !== 0) {
          const buffer = await sharp(fileLocation)
            .extend({
              right: 64 - (resizedWidth % 64),
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }

        const xSlices = [64, 128, 192, 256, 320]; // Horizontal slices parallel to the x-axis
        const maxYSlices = Math.floor(resizedWidth / 64);
        const ySlices = Array.from(
          { length: maxYSlices },
          (_, i) => 64 + i * 64
        );

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
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      // The original image is wider than it is taller (landscape), make the longer dimension 5 emoji long
      else {
        isLandcape = true;

        const resizedHeight = (
          await originalImage
            .resize(
              64 * 5, // width
              null // height
            )
            .toFile(fileLocation)
        ).height;

        // If resulting image height isn't divisible by 64, pad the bottom side so it is
        if (resizedHeight % 64 !== 0) {
          const buffer = await sharp(fileLocation)
            .extend({
              bottom: 64 - (resizedHeight % 64),
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }

        const ySlices = [64, 128, 192, 256, 320]; // Vertical slices parallel to the y-axis
        const maxXSlices = Math.floor(resizedHeight / 64);
        const xSlices = Array.from(
          { length: maxXSlices },
          (_, i) => 64 + i * 64
        );

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
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageData: returnList,
          isLandcape: isLandscape,
        }),
      };
    } catch {
      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 400,
        headers: {},
        body: "",
      };
    }
  }
};
