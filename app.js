const video = document.getElementById('camera');
const canvasWrapper = document.getElementById('canvas-wrapper');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const analysis = document.getElementById('analysis');
const lPlot = document.getElementById('l-plot');
const centerPixelL = document.getElementById('center-pixel-l');
const abPlot = document.getElementById('ab-plot');
const centerPixelAb = document.getElementById('center-pixel-ab');
const svgText = document.getElementById('svg-text');
const captureButton = document.getElementById('capture-button');
const overlayBackground = document.getElementById('overlay-background');
const overlayOption = document.getElementById('overlay-option');

// Sample a 10x10 pixel area
const sampleWidth = 10;
// Take the average of the past 5 samples
const recentSamplesLen = 5;
var recentSamples = [];

class StandardObserver {
    constructor(whiteX = 0.95047, whiteY = 1.00000, whiteZ = 1.08883) {
        this.d65WhiteX = 0.95047;
        this.d65WhiteY = 1.00000;
        this.d65WhiteZ = 1.08883;
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
        
        // De-normalize by reference white
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


// Update canvas with video feed
function updateCanvas() {
    // Mease canvas and video dimensions
    const canvasWidth = canvas.offsetWidth;
    const canvasHeight = canvas.offsetHeight;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

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

// Convert to l-plot coords
function labToLPlot(l, a, b) {
    const lPlotMin = 20;
    const lPlotMax = 80;
    const x = 5;
    const y = lPlotMax - l / 100 * (lPlotMax - lPlotMin)
    return { x, y };
}

// Convert to ab-plot coords
function labToAbPlot(l, a, b) {
    const abPlotMax = 44;
    const abMax = 100;
    const x = 50 + a * abPlotMax / abMax;
    const y = 50 - b * abPlotMax / abMax;
    return { x, y };
}

setInterval(() => {
    // Update canvas using video feed
    updateCanvas();

    // Get center pixel and map to Lab
    const envRgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const envLab = envObserver.rgbToLab(envRgb.r, envRgb.g, envRgb.b);

    // Push to queue and calculate mean
    recentSamples.push(envLab);
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
    const meanRgb = d65Observer.labToRgb(meanLab.l, meanLab.a, meanLab.b);
    
    // Update l-plot
    const lPlotCoords = labToLPlot(meanLab.l, meanLab.a, meanLab.b);
    centerPixelL.setAttribute('y1', lPlotCoords.y);
    centerPixelL.setAttribute('y2', lPlotCoords.y);
    centerPixelL.setAttribute('stroke', `RGB(${meanRgb.r},${meanRgb.g},${meanRgb.b})`);

    // Update ab-plot
    const AbPlotCoords = labToAbPlot(meanLab.l, meanLab.a, meanLab.b);
    centerPixelAb.setAttribute('cx', AbPlotCoords.x);
    centerPixelAb.setAttribute('cy', AbPlotCoords.y);
    centerPixelAb.setAttribute('fill', `RGB(${meanRgb.r},${meanRgb.g},${meanRgb.b})`);
    // svgText.textContent = `L*:${Math.round(meanLab.l)}, a*:${Math.round(meanLab.a)}, b*:${Math.round(meanLab.b)}`;
}, 100);

// Capture color
captureButton.addEventListener("click", () => {
    const envRgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const envLab = envObserver.rgbToLab(envRgb.r, envRgb.g, envRgb.b);
    const d65Rgb = d65Observer.labToRgb(envLab.l, envLab.a, envLab.b);
    const lPlotCoords = labToLPlot(envLab.l, envLab.a, envLab.b);
    const abPlotCoords = labToAbPlot(envLab.l, envLab.a, envLab.b);

    // Add new color to l-plot
    const capturedColorL = document.createElementNS("http://www.w3.org/2000/svg", 'line');
    capturedColorL.setAttribute('class', 'captured-color-l');
    capturedColorL.setAttribute('x1', 7);
    capturedColorL.setAttribute('y1', lPlotCoords.y);
    capturedColorL.setAttribute('x2', 13);
    capturedColorL.setAttribute('y2', lPlotCoords.y);
    capturedColorL.setAttribute('stroke', `RGB(${d65Rgb.r},${d65Rgb.g},${d65Rgb.b})`);
    capturedColorL.setAttribute('stroke-width', 1.5);
    capturedColorL.setAttribute('stroke-linecap', 'round');
    lPlot.insertBefore(capturedColorL, centerPixelL);

    // Add new color to ab-plot
    const capturedColorAb = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
    capturedColorAb.setAttribute('class', 'captured-color-ab');
    capturedColorAb.setAttribute('width', 10);
    capturedColorAb.setAttribute('height', 1);
    capturedColorAb.setAttribute('cx', abPlotCoords.x);
    capturedColorAb.setAttribute('cy', abPlotCoords.y);
    capturedColorAb.setAttribute('r', 1.5);
    capturedColorAb.setAttribute('fill', `RGB(${d65Rgb.r},${d65Rgb.g},${d65Rgb.b})`);
    abPlot.insertBefore(capturedColorAb, centerPixelAb);
    
    canvasWrapper.style.background = "#909090";
    setTimeout(() => {
        canvasWrapper.style.background = "#f0f0f0";
    }, 250);
});

// Set reference white
canvas.addEventListener("click", () => {
    const rgb = getPixel(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
    const xyz = envObserver.rgbToXyz(rgb.r, rgb.g, rgb.b);
    
    // Set reference white
    envObserver.setReferenceWhite(xyz.x, xyz.y, xyz.z);

    // Visual cues for reference white reset
    canvasWrapper.style.background = "#909090";
    setTimeout(() => {
        canvasWrapper.style.background = "#f0f0f0";
    }, 250);
});

// Click blank to remove all captures
abPlot.addEventListener("click", () => {
    const capturedColorsL = document.getElementsByClassName("captured-color-l");
    capturedColorsL[capturedColorsL.length - 1].remove();
    const capturedColorsAb = document.getElementsByClassName("captured-color-ab");
    capturedColorsAb[capturedColorsAb.length - 1].remove();
});


document.addEventListener('DOMContentLoaded', () => {
    overlayOption.addEventListener('click', () => {
        // Request camera access
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
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Hide overlay
        overlayBackground.style.display = 'none';
    }, { once: true });
});
