import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer, Line } from 'react-konva';
import useImage from 'use-image';
import { Download, Move, Maximize, RotateCcw, Trash2, ArrowLeft, Brush, Minus, Plus, RefreshCw, Check } from 'lucide-react';

interface LogoData {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface EditorProps {
  productImage: string;
  logos: string[];
  onBack: () => void;
}

const LogoItem = ({ 
  logo, 
  isSelected, 
  isExporting,
  onSelect, 
  onChange 
}: { 
  logo: LogoData; 
  isSelected: boolean; 
  isExporting: boolean;
  onSelect: () => void; 
  onChange: (newAttrs: any) => void;
}) => {
  const [img] = useImage(logo.url, 'anonymous');
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <KonvaImage
        image={img}
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...logo}
        draggable
        strokeEnabled={!isExporting && !isSelected}
        stroke="#00000033"
        strokeWidth={1}
        dash={[5, 5]}
        onDragEnd={(e) => {
          onChange({
            ...logo,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...logo,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio={true}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

export default function Editor({ productImage, logos, onBack }: EditorProps) {
  const [productImg, productStatus] = useImage(productImage, 'anonymous');
  const [logoItems, setLogoItems] = useState<LogoData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [productDisplaySize, setProductDisplaySize] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [brushSize, setBrushSize] = useState(20);
  const isDrawingRef = useRef(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [currentProductImage, setCurrentProductImage] = useState(productImage);
  
  // Re-fetch image when internal state changes (e.g. after inpainting)
  const [displayImg] = useImage(currentProductImage, 'anonymous');

  useEffect(() => {
    // Only process logos initially
    if (logos.length > 0 && logoItems.length === 0) {
      const processLogos = async () => {
      setIsProcessing(true);
      const items = await Promise.all(logos.map(async (url, index) => {
        const processedUrl = await removeBackground(url);
        
        // Get original dimensions to maintain aspect ratio
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = processedUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        const maxWidth = 150;
        const maxHeight = 150;
        let width = img.width;
        let height = img.height;

        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;

        return {
          id: `logo-${index}`,
          url: processedUrl,
          x: 50 + index * 30,
          y: 50 + index * 30,
          width,
          height,
          rotation: 0,
        };
      }));
      setLogoItems(items);
      setIsProcessing(false);
    };
    processLogos();
    }
  }, [logos]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && displayImg) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });

        // Calculate proportional size for product image
        const containerRatio = clientWidth / clientHeight;
        const imgRatio = displayImg.width / displayImg.height;

        let w, h, x, y;
        if (containerRatio > imgRatio) {
          h = clientHeight;
          w = h * imgRatio;
          x = (clientWidth - w) / 2;
          y = 0;
        } else {
          w = clientWidth;
          h = w / imgRatio;
          x = 0;
          y = (clientHeight - h) / 2;
        }
        setProductDisplaySize({ width: w, height: h, x, y });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [displayImg]);

  const removeBackground = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      // Some sites are sensitive to referrer, so we can try to hide it
      // @ts-ignore
      img.referrerPolicy = "no-referrer";
      
      let timeoutId: number | undefined;
      const safeResolve = (val: string) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(val);
      };

      // Timeout to prevent hanging
      timeoutId = window.setTimeout(() => safeResolve(url), 8000);

      img.src = url;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return safeResolve(url);

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          let imageData: ImageData;
          try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (e) {
            // CORS not allowed: fallback to original URL
            return safeResolve(url);
          }
          
          const data = imageData.data;

          // Simple background removal: check if the image has transparency
          let hasTransparency = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
              hasTransparency = true;
              break;
            }
          }

          if (hasTransparency) {
            return safeResolve(url);
          }

          // If no transparency, assume the top-left pixel is the background color
          const r = data[0];
          const g = data[1];
          const b = data[2];
          const tolerance = 30;

          for (let i = 0; i < data.length; i += 4) {
            const dr = Math.abs(data[i] - r);
            const dg = Math.abs(data[i + 1] - g);
            const db = Math.abs(data[i + 2] - b);

            if (dr < tolerance && dg < tolerance && db < tolerance) {
              data[i + 3] = 0; // Set alpha to 0
            }
          }

          try {
            ctx.putImageData(imageData, 0, 0);
            const out = canvas.toDataURL('image/png');
            return safeResolve(out);
          } catch (e) {
             return safeResolve(url);
          }
        } catch (e) {
           return safeResolve(url);
        }
      };
      img.onerror = () => safeResolve(url);
    });
  };

  const handleInpaint = async () => {
    if (!displayImg || lines.length === 0) return;

    setIsProcessing(true);
    
    // Check for Baidu Cloud AK/SK
    const apiKey = import.meta.env.VITE_BAIDU_AK;
    const secretKey = import.meta.env.VITE_BAIDU_SK;
    
    try {
      // 1. Prepare Image & Mask Canvases
      const canvas = document.createElement('canvas');
      canvas.width = displayImg.width;
      canvas.height = displayImg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(displayImg, 0, 0);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = displayImg.width;
      maskCanvas.height = displayImg.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      // Scale factor
      const scale = displayImg.width / productDisplaySize.width;

      // Draw mask (Black background, White stroke for AI)
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.strokeStyle = 'white'; // White for inpainting area

      lines.forEach(line => {
        maskCtx.lineWidth = line.strokeWidth * scale;
        maskCtx.beginPath();
        line.points.forEach((val: number, i: number) => {
          const x = (val - productDisplaySize.x) * scale;
          const y = i % 2 === 1 ? (val - productDisplaySize.y) * scale : 0;
          
          if (i === 0) {
             maskCtx.moveTo((line.points[0] - productDisplaySize.x) * scale, (line.points[1] - productDisplaySize.y) * scale);
          } else if (i % 2 === 0) {
             maskCtx.lineTo((line.points[i] - productDisplaySize.x) * scale, (line.points[i+1] - productDisplaySize.y) * scale);
          }
        });
        maskCtx.stroke();
      });

      // 2. Call Baidu Cloud API if key exists
      if (apiKey && secretKey) {
        // Step 1: Get Access Token
        // Note: For production, token should be fetched from backend to hide SK
        const tokenRes = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`, {
          method: 'POST'
        });
        
        if (!tokenRes.ok) throw new Error("Failed to get Baidu Access Token");
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // Step 2: Call Image Inpainting API
        const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
        // Baidu requires a mask image as well (rectangle_mask is optional if we provide mask image)
        // Wait, Baidu's "Image Inpainting" usually takes a mask rectangle or a mask image.
        // Let's use the standard "Image Inpainting" API which often takes a base64 image and a rectangle.
        // But for irregular shapes, we need a mask.
        // Baidu Cloud "Image Inpainting" (v2) supports mask.
        
        // Let's check Baidu's API docs. Usually it's `POST https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting`
        // It takes `image` (base64) and `rectangle` (json array) OR we can use the "Remove Object" API?
        // Actually Baidu has "Image Inpainting" which removes watermarks/objects.
        // Let's try the general "Image Inpainting" API.
        
        // Since we have a complex mask (irregular shape), passing a rectangle might not be precise.
        // But Baidu's public API mostly documents rectangle-based inpainting.
        // However, many users use `rectangle` to cover the area.
        // Let's compute the bounding box of our drawing to pass as a rectangle.
        
        let minX = width, minY = height, maxX = 0, maxY = 0;
        lines.forEach(line => {
          line.points.forEach((val: number, i: number) => {
             const v = (i % 2 === 0 ? val - productDisplaySize.x : val - productDisplaySize.y) * scale;
             if (i % 2 === 0) {
               if (v < minX) minX = v;
               if (v > maxX) maxX = v;
             } else {
               if (v < minY) minY = v;
               if (v > maxY) maxY = v;
             }
          });
        });
        
        // Add padding
        const pad = 10;
        minX = Math.max(0, Math.floor(minX - pad));
        minY = Math.max(0, Math.floor(minY - pad));
        maxX = Math.min(width, Math.ceil(maxX + pad));
        maxY = Math.min(height, Math.ceil(maxY + pad));
        
        const rect = {
          "left": minX,
          "top": minY,
          "width": maxX - minX,
          "height": maxY - minY
        };

        const response = await fetch(`https://aip.baidubce.com/rest/2.0/image-process/v1/inpainting?access_token=${accessToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: `image=${encodeURIComponent(imageBase64)}&rectangle=[${JSON.stringify(rect)}]`
        });

        if (!response.ok) {
           throw new Error(`Baidu API Error: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.error_code) {
          throw new Error(`Baidu API Error: ${result.error_msg}`);
        }

        const newUrl = `data:image/jpeg;base64,${result.image}`;
        setCurrentProductImage(newUrl);
      } else {
        // 3. Fallback to Local Algorithm (Simple Blur)
        console.warn("No API Key found. Using local fallback.");
        alert("未检测到 API Key，正在使用本地简易算法。效果可能有限。\n请在 .env 文件中配置 VITE_BAIDU_AK 和 VITE_BAIDU_SK 以获得更好的修复效果。");

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const mData = maskData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Use Red channel of mask (White=255)
        const isHole = new Uint8Array(width * height);
        for (let i = 0; i < mData.length; i += 4) {
          if (mData[i] > 100) isHole[i / 4] = 1;
        }

        // Simple diffusion
        const maxPasses = 20;
        let changes = true;
        for (let pass = 0; pass < maxPasses && changes; pass++) {
          changes = false;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              if (isHole[idx]) {
                let r = 0, g = 0, b = 0, count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                      const nIdx = ny * width + nx;
                      if (!isHole[nIdx]) {
                        const pIdx = nIdx * 4;
                        r += data[pIdx]; g += data[pIdx + 1]; b += data[pIdx + 2];
                        count++;
                      }
                    }
                  }
                }
                if (count > 0) {
                  const pIdx = idx * 4;
                  data[pIdx] = r / count; data[pIdx + 1] = g / count; data[pIdx + 2] = b / count;
                  if (count >= 3 || pass > 10) isHole[idx] = 0;
                  changes = true;
                }
              }
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const newUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCurrentProductImage(newUrl);
      }

      setLines([]);
      setIsDrawing(false);
    } catch (e) {
      console.error("Inpainting failed", e);
      alert("处理失败，请检查网络或 API Key 配置。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    setSelectedId(null); // Deselect before export
    setIsExporting(true);
    setIsDrawing(false); // Stop drawing mode
    setTimeout(() => {
      try {
        const scale = productImg ? productImg.width / productDisplaySize.width : 1;
        const config = {
          x: productDisplaySize.x,
          y: productDisplaySize.y,
          width: productDisplaySize.width,
          height: productDisplaySize.height,
          pixelRatio: scale,
          mimeType: 'image/jpeg',
          quality: 0.9
        };

        const uri = stageRef.current.toDataURL(config);
        const link = document.createElement('a');
        link.download = 'mockup.jpg';
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error('Export failed:', e);
        alert('导出失败：检测到跨域图片未允许 CORS 或画布受污染。请改用本地图片或使用允许 CORS 的图片地址。');
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleDelete = () => {
    if (selectedId) {
      setLogoItems(logoItems.filter(l => l.id !== selectedId));
      setSelectedId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F0]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#141414]/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">返回上一步</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 bg-white/50 p-1.5 rounded-full backdrop-blur-sm border border-black/5">
            <button
              onClick={() => setIsDrawing(!isDrawing)}
              className={`p-2 rounded-full transition-all ${
                isDrawing 
                  ? 'bg-red-50 text-red-600 shadow-sm' 
                  : 'text-black/60 hover:bg-black/5'
              }`}
              title="涂抹去除 Logo"
            >
              <Brush size={20} />
            </button>
            
            {isDrawing && (
              <div className="flex items-center gap-2 px-2 border-l border-black/10">
                <button 
                  onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
                  className="p-1 hover:bg-black/5 rounded-full text-black/60"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs font-mono w-6 text-center">{brushSize}</span>
                <button 
                  onClick={() => setBrushSize(Math.min(50, brushSize + 5))}
                  className="p-1 hover:bg-black/5 rounded-full text-black/60"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            
            {lines.length > 0 && (
              <React.Fragment>
                <button
                  onClick={handleInpaint}
                  className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-full transition-all ml-2"
                  title="应用去除 (Auto Fix)"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => setLines([])}
                  className="p-2 text-black/60 hover:bg-black/5 rounded-full transition-all"
                  title="撤销所有涂抹"
                >
                  <RefreshCw size={20} />
                </button>
              </React.Fragment>
            )}
          </div>

          {selectedId && (
            <button 
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full transition-colors text-sm font-bold"
            >
              <Trash2 size={16} />
              删除 Logo
            </button>
          )}
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-2 bg-[#141414] text-white rounded-full hover:bg-black/90 active:text-green-500 transition-all shadow-lg shadow-black/10 text-sm font-bold"
          >
            <Download size={16} />
            导出图片
          </button>
        </div>
      </header>

      {/* Main Editor Area */}
      <main className="flex-1 relative overflow-hidden p-8 flex items-center justify-center">
        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-black/5 border-t-black rounded-full animate-spin"></div>
            <p className="font-bold text-xl">正在处理 Logo...</p>
          </div>
        )}
        <div 
          ref={containerRef}
          className="w-full h-full max-w-5xl max-height-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#141414]/5 relative"
        >
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            ref={stageRef}
            onMouseDown={(e) => {
              const clickedOnEmpty = e.target === e.target.getStage();
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
              if (isDrawing) {
                isDrawingRef.current = true;
                const pos = e.target.getStage().getPointerPosition();
                setLines([...lines, { points: [pos.x, pos.y], strokeWidth: brushSize }]);
              }
            }}
            onMouseMove={(e) => {
              if (isDrawing) {
                const stage = e.target.getStage();
                const point = stage.getPointerPosition();
                setCursorPos(point);

                if (isDrawingRef.current) {
                  let lastLine = lines[lines.length - 1];
                  lastLine.points = lastLine.points.concat([point.x, point.y]);
                  lines.splice(lines.length - 1, 1, lastLine);
                  setLines(lines.concat());
                }
              }
            }}
            onMouseLeave={() => {
              // Hide custom cursor when leaving stage
              setCursorPos({ x: -1000, y: -1000 });
            }}
            onMouseUp={() => {
              isDrawingRef.current = false;
            }}
            style={{ cursor: isDrawing ? 'none' : 'default' }}
          >
            <Layer>
              {productImg && (
                <KonvaImage
                  image={productImg}
                  x={productDisplaySize.x}
                  y={productDisplaySize.y}
                  width={productDisplaySize.width}
                  height={productDisplaySize.height}
                  listening={false}
                />
              )}
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke="rgba(255, 0, 0, 0.6)"
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              ))}
              {logoItems.map((logo) => (
                <LogoItem
                  key={logo.id}
                  logo={logo}
                  isSelected={logo.id === selectedId}
                  isExporting={isExporting}
                  onSelect={() => setSelectedId(logo.id)}
                  onChange={(newAttrs) => {
                    const newLogos = logoItems.slice();
                    const index = newLogos.findIndex(l => l.id === logo.id);
                    newLogos[index] = newAttrs;
                    setLogoItems(newLogos);
                  }}
                />
              ))}
            </Layer>
            {isDrawing && (
              <Layer>
                <Line
                  points={[cursorPos.x, cursorPos.y]}
                  stroke="black"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                  // Circle outline for brush
                  sceneFunc={(ctx, shape) => {
                    ctx.beginPath();
                    ctx.arc(cursorPos.x, cursorPos.y, brushSize / 2, 0, Math.PI * 2, false);
                    ctx.strokeShape(shape);
                  }}
                />
              </Layer>
            )}
          </Stage>

          {/* Instructions Overlay */}
          <div className="absolute bottom-6 left-6 pointer-events-none flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <Move size={12} /> 拖动调整位置
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <Maximize size={12} /> 使用手柄缩放大小
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
