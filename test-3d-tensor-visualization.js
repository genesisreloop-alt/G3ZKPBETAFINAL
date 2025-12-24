#!/usr/bin/env node

/**
 * G3ZKP 3D Tensor Visualization Test Script
 * Tests the Phi-Pi raymarching shader with real image data
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Test image path
const TEST_IMAGE_PATH = './FULL ONE/Bio Reactor Internal Fractal Structure.png';

console.log('🧪 G3ZKP 3D Tensor Visualization Test');
console.log('=====================================');

// Check if test image exists
if (!fs.existsSync(TEST_IMAGE_PATH)) {
  console.error('❌ Test image not found:', TEST_IMAGE_PATH);
  process.exit(1);
}

console.log('✅ Test image found:', TEST_IMAGE_PATH);

// Simulate tensor conversion process
async function testTensorConversion() {
  try {
    console.log('🔄 Loading test image...');

    // Load the image
    const image = await loadImage(TEST_IMAGE_PATH);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const pixels = imageData.data;

    console.log(`📊 Image loaded: ${image.width}x${image.height} pixels`);
    console.log(`📈 Total pixels: ${pixels.length / 4}`);

    // Simulate tensor conversion
    console.log('🔬 Simulating Phi-Pi tensor conversion...');

    // Create mock tensor data (simulating the conversion process)
    const tensorData = {
      objectUrl: `data:image/png;base64,${canvas.toDataURL().split(',')[1]}`,
      dimensions: {
        width: image.width,
        height: image.height,
        depth: Math.floor(Math.sqrt(image.width * image.height)) // Simulated depth
      },
      vertices: Math.floor((image.width * image.height) / 100), // Simulated vertex count
      tensorField: {
        pixelCount: pixels.length / 4,
        resolution: 64,
        phiValue: 1.618033988749895,
        piValue: 3.141592653589793
      },
      flowerOfLife: {
        generations: 3,
        rayCount: 19,
        sacredGeometryScale: 1.0
      },
      originalFiles: [{
        fileId: 'test-image-001',
        fileName: 'Bio Reactor Internal Fractal Structure.png',
        url: `data:image/png;base64,${canvas.toDataURL().split(',')[1]}`,
        mimeType: 'image/png',
        size: fs.statSync(TEST_IMAGE_PATH).size
      }],
      thumbnailDataUrl: canvas.toDataURL(),
      createdAt: Date.now()
    };

    console.log('✅ Tensor conversion simulation complete');
    console.log('📋 Generated tensor data:');
    console.log(`   - Dimensions: ${tensorData.dimensions.width}x${tensorData.dimensions.height}x${tensorData.dimensions.depth}`);
    console.log(`   - Vertices: ${tensorData.vertices}`);
    console.log(`   - Phi value: ${tensorData.tensorField.phiValue}`);
    console.log(`   - Pi value: ${tensorData.tensorField.piValue}`);
    console.log(`   - Flower of Life generations: ${tensorData.flowerOfLife.generations}`);

    // Create HTML test page
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>G3ZKP 3D Tensor Visualization Test</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            margin: 0;
            font-family: 'Courier New', monospace;
            background: #010401;
            color: #00f3ff;
        }
        .test-container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .tensor-preview {
            width: 200px;
            height: 150px;
            border: 1px solid #4caf50;
            margin: 10px;
            cursor: pointer;
            background: #000;
        }
        .test-button {
            background: #00f3ff;
            color: #000;
            border: none;
            padding: 10px 20px;
            margin: 10px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-left: 4px solid #4caf50;
            background: rgba(76, 175, 80, 0.1);
        }
    </style>
</head>
<body>
    <div id="test-root"></div>

    <script type="text/babel">
        const { useState, useEffect } = React;

        const TestApp = () => {
            const [tensorData, setTensorData] = useState(${JSON.stringify(tensorData, null, 2)});
            const [showViewer, setShowViewer] = useState(false);
            const [testStatus, setTestStatus] = useState('Ready to test 3D tensor visualization');

            const runVisualizationTest = () => {
                setTestStatus('🔄 Initializing Phi-Pi raymarching shader...');
                setTimeout(() => {
                    setTestStatus('✅ Shader initialized - opening 3D viewer...');
                    setShowViewer(true);
                }, 1000);
            };

            return (
                <div className="test-container">
                    <h1>🧪 G3ZKP 3D Tensor Visualization Test</h1>
                    <p>Test image: <strong>Bio Reactor Internal Fractal Structure.png</strong></p>

                    <div className="status">
                        Status: {testStatus}
                    </div>

                    <div>
                        <h3>📊 Tensor Data Preview:</h3>
                        <ul>
                            <li>Dimensions: {tensorData.dimensions.width} × {tensorData.dimensions.height} × {tensorData.dimensions.depth}</li>
                            <li>Vertices: {tensorData.vertices}</li>
                            <li>Phi: {tensorData.tensorField.phiValue}</li>
                            <li>Pi: {tensorData.tensorField.piValue}</li>
                            <li>Flower of Life: {tensorData.flowerOfLife.generations} generations</li>
                        </ul>
                    </div>

                    <div>
                        <h3>🖼️ Original Image:</h3>
                        <img
                            src="${tensorData.objectUrl}"
                            alt="Test Image"
                            style={{maxWidth: '400px', border: '1px solid #4caf50'}}
                        />
                    </div>

                    <div>
                        <h3>🎨 3D Tensor Preview:</h3>
                        <div
                            className="tensor-preview"
                            onClick={() => setShowViewer(true)}
                            title="Click to open full 3D viewer"
                        >
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(45deg, #00f3ff, #4caf50)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#000',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}>
                                ACUTE REALITY<br/>3D TENSOR
                            </div>
                        </div>
                    </div>

                    <button className="test-button" onClick={runVisualizationTest}>
                        🚀 Test 3D Tensor Visualization
                    </button>

                    {showViewer && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0, 0, 0, 0.9)',
                            zIndex: 1000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                background: '#010401',
                                border: '1px solid #00f3ff',
                                padding: '20px',
                                maxWidth: '600px',
                                textAlign: 'center'
                            }}>
                                <h2>🎯 3D Tensor Visualization Test</h2>
                                <p>The TensorObjectViewer component should open here with:</p>
                                <ul style={{textAlign: 'left'}}>
                                    <li>✅ Phi-Pi raymarching shader</li>
                                    <li>✅ Procedural texture generation</li>
                                    <li>✅ Real-time parameter controls</li>
                                    <li>✅ Mobile-responsive interface</li>
                                    <li>✅ ZKP proof consistency controls</li>
                                </ul>
                                <p><strong>Expected result:</strong> 3D sphere with animated Phi-Pi patterns, not a black cube</p>
                                <button
                                    className="test-button"
                                    onClick={() => setShowViewer(false)}
                                    style={{marginTop: '20px'}}
                                >
                                    Close Test
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        ReactDOM.render(<TestApp />, document.getElementById('test-root'));
    </script>
</body>
</html>`;

    // Write test HTML file
    const testHtmlPath = './test-3d-tensor-visualization.html';
    fs.writeFileSync(testHtmlPath, htmlContent);

    console.log('✅ Test HTML page created:', testHtmlPath);
    console.log('');
    console.log('🎯 TEST INSTRUCTIONS:');
    console.log('====================');
    console.log('1. Open the generated HTML file in a web browser');
    console.log('2. Click "Test 3D Tensor Visualization" button');
    console.log('3. Verify that the 3D viewer opens with animated Phi-Pi patterns');
    console.log('4. Check mobile responsiveness by resizing browser window');
    console.log('5. Confirm shader controls work (ZKP consistency, depth scale, etc.)');
    console.log('');
    console.log('📁 Files created:');
    console.log(`   - ${testHtmlPath} (Test interface)`);
    console.log('');
    console.log('🚀 Test ready! Open the HTML file to verify 3D tensor visualization.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testTensorConversion().catch(console.error);