const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

// Slack uses JUMBOMOJI for less than 23 emoji in one message, so we'll have either a (4x5) or a (5x4) mosaic
// This requires padding either the bottom or the right hand side of the image, depending on which original dimension is longer to preserve landscape vs. portrait
exports.handler = async (event, context) => {
  console.log(JSON.stringify(event));

  if (event.body) {
    try {
      // Return variables
      var returnParts = [];

      // Scratch location for image manipulations
      const fileLocation = `/tmp/${uuidv4()}.png`;

      // Load input image
      const inputImage = sharp(Buffer.from(event.body, "base64"));

      // Get orientation based on EXIF metadata
      const size = getNormalSize(await inputImage.metadata());
      const originalHeight = size.height;
      const originalWidth = size.width;

      console.log(
        `Received image of (${originalWidth} x ${originalHeight}) (W x H)`
      );

      // These will hold the resized values once manipulations and calculations are done
      let resizedHeight = 0;
      let resizedWidth = 0;

      // If the original image is taller than it is wider (portrait),
      // and its aspect ratio is less-than or equal to 0.75,
      // then make the longer dimension (height) 5 emoji tall
      if (
        originalHeight > originalWidth &&
        originalWidth / originalHeight <= 0.75
      ) {
        resizedHeight = 64 * 5;
        resizedWidth = (
          await inputImage
            .rotate()
            .resize(
              null, // width
              resizedHeight // height
            )
            .toFile(fileLocation)
        ).width;

        // If resulting image width isn't evenly divisible by 64, pad the right side to the nearest divisible whole number
        if (resizedWidth % 64 !== 0) {
          padding = 64 - (resizedWidth % 64); // Number of pixels to make width evenly divisible by 64
          resizedWidth += padding; // New width = old width + padding

          // Intermediate variable to write out to same location
          const buffer = await sharp(fileLocation)
            .rotate()
            .extend({
              right: padding,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }
      }
      // If the original image is wider than it is taller (landscape),
      // and its aspect ratio is less-than or equal to 0.75,
      // then make the longer dimension (width) 5 emoji wide
      else if (
        originalWidth > originalHeight &&
        originalHeight / originalWidth <= 0.75
      ) {
        resizedWidth = 64 * 5;
        resizedHeight = (
          await inputImage
            .rotate()
            .resize(
              resizedWidth, // width
              null // height
            )
            .toFile(fileLocation)
        ).height;

        // If resulting image height isn't evenly divisible by 64, pad the bottom side to the nearest divisible whole number
        if (resizedHeight % 64 !== 0) {
          padding = 64 - (resizedHeight % 64); // Number of pixels to make height evenly divisible by 64
          resizedHeight += padding; // New height = old height + padding

          // Intermediate variable to write out to same location
          const buffer = await sharp(fileLocation)
            .rotate()
            .extend({
              bottom: padding,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }
      }
      // Otherwise, the original image is square-ish -- either perfectly square or has an aspect ratio greater than 0.75
      // Fall back to (4x4) to preserve aspect ratio while still under JUMBOMOJI limit
      else {
        const resizedImage = await inputImage
          .rotate()
          .resize(
            originalWidth > originalHeight ? 64 * 4 : null, // width
            originalWidth > originalHeight ? null : 64 * 4 // height
          )
          .toFile(fileLocation);

        resizedWidth = resizedImage.width;
        resizedHeight = resizedImage.height;

        // If resulting image height isn't evenly divisible by 64, pad the bottom side to the nearest divisible whole number
        if (resizedWidth > resizedHeight && resizedHeight % 64 !== 0) {
          padding = 64 - (resizedHeight % 64); // Number of pixels to make height evenly divisible by 64
          resizedHeight += padding; // New height = old height + padding

          // Intermediate variable to write out to same location
          const buffer = await sharp(fileLocation)
            .rotate()
            .extend({
              bottom: padding,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }
        // If resulting image width isn't evenly divisible by 64, pad the right side to the nearest divisible whole number
        else if (resizedHeight > resizedWidth && resizedWidth % 64 !== 0) {
          padding = 64 - (resizedWidth % 64); // Number of pixels to make width evenly divisible by 64
          resizedWidth += padding; // New width = old width + padding

          // Intermediate variable to write out to same location
          const buffer = await sharp(fileLocation)
            .rotate()
            .extend({
              right: padding,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .toBuffer();

          await sharp(buffer).toFile(fileLocation);
        }
      }

      console.log(
        `Resized image to (${resizedWidth} x ${resizedHeight}) (W x H)`
      );

      // For each "block" of square 64-px height
      for (var i = 0; i < resizedHeight / 64; i++) {
        // For each "block" of square 64-px width
        for (var j = 0; j < resizedWidth / 64; j++) {
          const part = (
            await sharp(fileLocation)
              .extract({
                left: j * 64,
                top: i * 64,
                width: 64,
                height: 64,
              })
              .toBuffer()
          ).toString("base64");

          returnParts.push(part);
        }
      }

      return {
        cookies: [],
        isBase64Encoded: false,
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageData: {
            imageParts: returnParts,
            imageWidth: resizedWidth / 64,
          },
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

function getNormalSize({ width, height, orientation }) {
  return (orientation || 0) >= 5
    ? { width: height, height: width }
    : { width, height };
}
