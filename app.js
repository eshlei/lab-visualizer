const video = document.getElementById('camera');
const analysisContainer = document.getElementById('analysis-container');
const analysis = document.getElementById('analysis');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const centerPixel = document.getElementById('center-pixel');

const sampleWindow = 10;
var backgroundX = 0.95047; // D65 white point
var backgroundY = 1.00000; // D65 white point
var backgroundZ = 1.08883; // D65 white point

var queue = [0, 0, 10]

// Request camera access
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.play();
    })
    .catch(err => {
        console.error('Error accessing the camera: ', err);
    });

// Update canvas with video feed
function updateCanvas() {
    // Remeasure canvas and video width
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Update canvas
    var scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    sWidth = canvasWidth / scale;
    sHeight = canvasHeight / scale;
    sx = (videoWidth - sWidth) / 2;
    sy = (videoHeight - sHeight) / 2;
    context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);

    // Redraw circle
    context.beginPath();
    context.rect(canvasWidth / 2 - sampleWindow / 2, canvasHeight / 2 - sampleWindow / 2, sampleWindow, sampleWindow);
    context.stroke();
}

// Get RGB values of a pixel
function getPixel(x, y) {
    const data = context.getImageData(x - sampleWindow / 2, y - sampleWindow / 2, sampleWindow, sampleWindow).data;
    
    var [ r, g, b ] = [ 0, 0, 0 ];
    const pixelCount = sampleWindow * sampleWindow;
    for (let i = 0; i < pixelCount; i++) {
        r += data[4 * i];
        g += data[4 * i + 1];
        b += data[4 * i + 2];
    }
    console.log(r / pixelCount, g / pixelCount, b / pixelCount);
    return [ r / pixelCount, g / pixelCount, b / pixelCount ];
}

function plotPixel(labL, labA, labB, colorCode) {
    const canvasCoordsMax = 44;
    const abMax = 50;
    const abToCanvasCoords = canvasCoordsMax / abMax;
    centerPixel.style.cx = 50 + labA * abToCanvasCoords;
    centerPixel.style.cy = 50 - labB * abToCanvasCoords;
    centerPixel.style.fill = colorCode;
}

setInterval(() => {
    // Update canvas using video feed
    updateCanvas();

    // Get center pixel and map to CIELab
    const [ rgbR, rgbG, rgbB ] = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const [ xyzX, xyzY, xyzZ ] = rgbToXyz(rgbR, rgbG, rgbB);
    const [ labL, labA, labB ] = xyzToLab(xyzX, xyzY, xyzZ, backgroundX, backgroundY, backgroundZ);

    // Update plot
    plotPixel(labL, labA, labB, `RGB(${rgbR},${rgbG},${rgbB})`);

    alert('canvas updated!')
}, 1000);

analysis.addEventListener("click", () => {
    const [ rgbR, rgbG, rgbB ] = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    [ backgroundX, backgroundY, backgroundZ ] = rgbToXyz(rgbR, rgbG, rgbB);
    alert(`Set reference white to XYZ(${backgroundX.toFixed(2)}, ${backgroundY.toFixed(2)}, ${backgroundZ.toFixed(2)})`);
})

window.onresize = () => {
    location.reload();
}

// Convert RGB to XYZ
function rgbToXyz(r, g, b) {
    // Convert RGB to a range of [0, 1]
    r /= 255;
    g /= 255;
    b /= 255;
  
    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // Convert to XYZ using the D65 illuminant
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  
    return [ x, y, z ];
  }
  
// Convert XYZ to CIELAB
function xyzToLab(x, y, z, refX, refY, refZ) {
    x /= refX;
    y /= refY;
    z /= refZ;
  
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
  
    const l = (116 * y) - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);
  
    return [ l, a, b ];
}