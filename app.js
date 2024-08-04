const video = document.getElementById('camera');
const canvasContainer = document.getElementById('canvas-container');
const analysis = document.getElementById('analysis');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const centerPixel = document.getElementById('center-pixel');
const centerPixelText = document.getElementById('center-pixel-text');

class StandardObserver {
    constructor(whiteX = 0.95047, whiteY = 1.00000, whiteZ = 1.08883) {
        this.whiteX = whiteX;
        this.whiteY = whiteY;
        this.whiteZ = whiteZ;
    }

    setReferenceWhite(whiteX, whiteY, whiteZ) {
        this.whiteX = whiteX;
        this.whiteY = whiteY;
        this.whiteZ = whiteZ;
    }
    
    rgbToXyz(r, g, b) {
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
    
        return { x, y, z };
    }

    xyzToLab(x, y, z) {
        // Normalize by reference white
        x /= this.whiteX;
        y /= this.whiteY;
        z /= this.whiteZ;
    
        // Convert XYZ to Lab
        x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
        y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
        z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
    
        // Rescale and translate
        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b = 200 * (y - z);
    
        return { l, a, b };
    }

    xyzToRgb(x, y, z) {

        // Convert XYZ to linear RGB
        let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
        let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
        let b = x * 0.0557 + y * -0.2040 + z * 1.0570;

        // Apply gamma correction
        r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

        // Clip the values to [0, 1] range
        r = Math.max(0, Math.min(1, r));
        g = Math.max(0, Math.min(1, g));
        b = Math.max(0, Math.min(1, b));

        // Convert to [0, 255] range
        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);

        return { r, g, b };
    }

    labToXyz(l, a, b) {
        // Rescale and translate
        const y = (l + 16) / 116;
        const x = a / 500 + y;
        const z = y - b / 200;

        // Compute intermediate values
        const x3 = Math.pow(x, 3);
        const y3 = Math.pow(y, 3);
        const z3 = Math.pow(z, 3);

        // Convert to reference white
        let xr = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
        let yr = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
        let zr = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

        xr *= this.whiteX;
        yr *= this.whiteY;
        zr *= this.whiteZ;

        return { x: xr, y: yr, z: zr };
    }

    labToRgb(l, a, b) {
        const xyz = this.labToXyz(l, a, b);
        const rgb = this.xyzToRgb(xyz.x, xyz.y, xyz.z);
        return rgb;
    }
    
    rgbToLab(r, g, b) {
        const xyz = this.rgbToXyz(r, g, b);
        const lab = this.xyzToLab(xyz.x, xyz.y, xyz.z);
        return lab;
    }
}


const envObserver = new StandardObserver();
const d65Observer = new StandardObserver();
const sampleWidth = 10; // Sample a 10x10 pixel area
const recentSamplesLen = 10; // Take the average of the past 3 samples
var recentSamples = [];

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

    // Redraw rectangle
    context.beginPath();
    context.rect(canvasWidth / 2 - sampleWidth / 2, canvasHeight / 2 - sampleWidth / 2, sampleWidth, sampleWidth);
    context.stroke();
}

// Get RGB values of a pixel
function getPixel(x, y) {
    const data = context.getImageData(x - sampleWidth / 2, y - sampleWidth / 2, sampleWidth, sampleWidth).data;
    
    const pixelCount = sampleWidth * sampleWidth;
    var meanRgb = { r: 0, g: 0, b: 0 };
    for (let i = 0; i < pixelCount; i++) {
        meanRgb.r += data[4 * i];
        meanRgb.g += data[4 * i + 1];
        meanRgb.b += data[4 * i + 2];
    }
    meanRgb.r /= pixelCount;
    meanRgb.g /= pixelCount;
    meanRgb.b /= pixelCount;
    return {r: meanRgb.r, g: meanRgb.g, b: meanRgb.b };
}

function plotPixel(lab) {

    // Convert to D65 illumination
    const rgb = d65Observer.labToRgb(lab.l, lab.a, lab.b);
    
    const canvasCoordsMax = 44;
    const abMax = 100;
    const abToCanvasCoords = canvasCoordsMax / abMax;
    centerPixel.setAttribute('cx', 50 + lab.a * abToCanvasCoords);
    centerPixel.setAttribute('cy', 50 - lab.b * abToCanvasCoords);
    centerPixel.setAttribute('fill', `RGB(${rgb.r},${rgb.g},${rgb.b})`);

    centerPixelText.textContent = `L:${Math.round(lab.l)}, a:${Math.round(lab.a)}, b:${Math.round(lab.b)}`;
}

setInterval(() => {
    // Update canvas using video feed
    updateCanvas();

    // Get center pixel and map to CIELab
    const rgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const lab = envObserver.rgbToLab(rgb.r, rgb.g, rgb.b);

    // Push to queue and calculate mean
    recentSamples.push(lab);
    if (recentSamples.length > recentSamplesLen) {
        recentSamples.shift();
    }
    let meanLab = { l: 0, a: 0, b: 0 };
    for (let idx in recentSamples) {
        meanLab.l += recentSamples[idx].l;
        meanLab.a += recentSamples[idx].a;
        meanLab.b += recentSamples[idx].b;
    }
    meanLab.l /= recentSamplesLen;
    meanLab.a /= recentSamplesLen;
    meanLab.b /= recentSamplesLen;

    // Update plot
    plotPixel(meanLab);
}, 100);

analysis.addEventListener("click", () => {
    // Set reference white
    const rgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const xyz = envObserver.rgbToXyz(rgb.r, rgb.g, rgb.b);
    envObserver.setReferenceWhite(xyz.x, xyz.y, xyz.z);

    // Visual cues for reference white reset
    canvasContainer.style.background = "#909090";
    setTimeout(() => {
        canvasContainer.style.background = "#f0f0f0";
      }, 250);
})

window.onresize = () => {
    location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', () => {
        navigator.mediaDevices.getUserMedia({video: {facingMode: {exact: 'environment'}}})
        .then(stream => {
            video.srcObject = stream;
            video.play();
        })
        .catch(() => {
            navigator.mediaDevices.getUserMedia({video: true})
            .then(stream => {
                video.srcObject = stream;
                video.play();
            })
        })
        .catch(err => {
            alert('Error accessing the camera: ', err);
        })
    }, { once: true });
});