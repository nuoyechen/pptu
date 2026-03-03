import React, { useState, useRef, useEffect } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';
import { Download, Move, Maximize, ArrowLeft, MousePointer2, RefreshCw, Check, SunMoon, Trash2, Palette } from 'lucide-react';

// 纯色预设，用于将抠出的 Logo 改为指定颜色
const PRESET_COLORS = [
  { name: '黑', value: '#000000' },
  { name: '白', value: '#ffffff' },
  { name: '蓝', value: '#2563eb' },
  { name: '红', value: '#dc2626' },
  { name: '绿', value: '#16a34a' },
  { name: '黄', value: '#eab308' },
  { name: '紫', value: '#9333ea' },
  { name: '橙', value: '#ea580c' },
];

// 自定义 Konva 滤镜：将 Logo 非透明区域改为纯色
function createRecolorFilter(hexColor: string) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return function (imageData: ImageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 30) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
  };
}

interface LogoData {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isInverted?: boolean;
  logoColor?: string;
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

  // Apply filters: 纯色 / 反相 / 原样
  useEffect(() => {
    if (shapeRef.current && img) {
      shapeRef.current.clearCache();
      const ratio = Math.max(1, window.devicePixelRatio || 1) * 2;
      shapeRef.current.cache({ pixelRatio: ratio });

      if (logo.logoColor) {
        shapeRef.current.filters([createRecolorFilter(logo.logoColor)]);
      } else if (logo.isInverted) {
        shapeRef.current.filters([Konva.Filters.Invert]);
      } else {
        shapeRef.current.filters([]);
        shapeRef.current.clearCache();
      }

      shapeRef.current.getLayer()?.batchDraw();
    }
  }, [logo.logoColor, logo.isInverted, img, logo.width, logo.height]);

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

          // Reset scale to 1 and update width/height
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
  const [isSelecting, setIsSelecting] = useState(false);
  const [rectangles, setRectangles] = useState<{ x: number; y: number; width: number; height: number }[]>([]);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
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
    const rectsToUse = currentRect ? [...rectangles, currentRect] : rectangles;
    if (rectsToUse.length === 0) {
      alert("请先用选区工具框选需要去除的区域。");
      return;
    }
    const imgToUse = displayImg || productImg;
    if (!imgToUse) {
      alert("图片尚未加载完成，请稍候再试。");
      return;
    }
    if (productDisplaySize.width <= 0 || productDisplaySize.height <= 0) {
      alert("画布尺寸异常，请刷新页面后重试。");
      return;
    }

    setIsProcessing(true);
    
    const apiKey = import.meta.env.VITE_BAIDU_AK;
    const secretKey = import.meta.env.VITE_BAIDU_SK;
    const scale = imgToUse.width / productDisplaySize.width;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgToUse.width;
      canvas.height = imgToUse.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }
      ctx.drawImage(imgToUse, 0, 0);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imgToUse.width;
      maskCanvas.height = imgToUse.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        setIsProcessing(false);
        return;
      }

      // Black background, white rectangles for inpainting area
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCtx.fillStyle = 'white';
      rectsToUse.forEach(r => {
        const x = Math.round((r.x - productDisplaySize.x) * scale);
        const y = Math.round((r.y - productDisplaySize.y) * scale);
        const w = Math.max(1, Math.round(r.width * scale));
        const h = Math.max(1, Math.round(r.height * scale));
        maskCtx.fillRect(x, y, w, h);
      });

      const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
      const imgWidth = imgToUse.width;
      const imgHeight = imgToUse.height;

      const firstRect = rectsToUse[0];
      const rectX = Math.round((firstRect.x - productDisplaySize.x) * scale);
      const rectY = Math.round((firstRect.y - productDisplaySize.y) * scale);
      const rectW = Math.max(1, Math.round(firstRect.width * scale));
      const rectH = Math.max(1, Math.round(firstRect.height * scale));

      const rect = {
        left: Math.max(0, rectX),
        top: Math.max(0, rectY),
        width: Math.min(imgWidth - rectX, rectW),
        height: Math.min(imgHeight - rectY, rectH)
      };

      // 生产环境（Vercel）使用服务端 API 路由，避免代理不可用
      const useServerApi = import.meta.env.PROD;

      if (useServerApi) {
        const apiUrl = `${window.location.origin}/api/baidu-inpaint`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64, rectangle: [rect] })
        });
        const text = await response.text();
        let result: { error_code?: string; error_msg?: string; image?: string };
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            response.ok
              ? 'API 返回格式异常，请稍后重试'
              : `请求失败 (${response.status})：请确认已在 Vercel 配置 VITE_BAIDU_AK 和 VITE_BAIDU_SK 环境变量`
          );
        }
        if (!response.ok || result.error_code) {
          throw new Error(result.error_msg || '图像修复请求失败');
        }
        if (!result.image) throw new Error("API 未返回修复后的图片");
        setCurrentProductImage(`data:image/jpeg;base64,${result.image}`);
      } else if (apiKey && secretKey) {
        const tokenRes = await fetch(`/baidu-api/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`, {
          method: 'POST'
        });
        if (!tokenRes.ok) throw new Error("Failed to get Baidu Access Token");
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error || "Token 获取失败");
        const accessToken = tokenData.access_token;
        if (!accessToken) throw new Error("未返回 access_token");

        const response = await fetch(`/baidu-api/rest/2.0/image-process/v1/inpainting?access_token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Accept': 'application/json' },
          body: JSON.stringify({ image: imageBase64, rectangle: [rect] })
        });
        if (!response.ok) throw new Error(`Baidu API Error: ${response.statusText}`);
        const result = await response.json();
        if (result.error_code) throw new Error(result.error_msg || `错误码: ${result.error_code}`);
        if (!result.image) throw new Error("API 未返回修复后的图片");
        setCurrentProductImage(`data:image/jpeg;base64,${result.image}`);
      } else {
        // Local fallback: fill with surrounding content
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const mData = maskData.data;
        const width = canvas.width;
        const height = canvas.height;

        const isHole = new Uint8Array(width * height);
        for (let i = 0; i < mData.length; i += 4) {
          if (mData[i] > 100) isHole[i / 4] = 1;
        }

        const maxPasses = 30;
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

      setRectangles([]);
      setCurrentRect(null);
      setIsSelecting(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Inpainting failed", e);
      alert("处理失败：" + msg + "\n请检查网络或 API Key 配置。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    setSelectedId(null);
    setIsExporting(true);
    setIsSelecting(false);
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

  const handleInvert = () => {
    if (selectedId) {
      const newLogos = logoItems.slice();
      const index = newLogos.findIndex(l => l.id === selectedId);
      newLogos[index] = {
        ...newLogos[index],
        isInverted: !newLogos[index].isInverted,
        logoColor: undefined, // 改色与反相互斥
      };
      setLogoItems(newLogos);
    }
  };

  const handleLogoColor = (color: string | undefined) => {
    if (selectedId) {
      const newLogos = logoItems.slice();
      const index = newLogos.findIndex(l => l.id === selectedId);
      newLogos[index] = {
        ...newLogos[index],
        logoColor: color,
        isInverted: color ? false : newLogos[index].isInverted, // 改色时取消反相
      };
      setLogoItems(newLogos);
    }
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
      <header className="relative z-20 flex items-center justify-between px-8 py-4 bg-white border-b border-[#141414]/10">
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
              type="button"
              onClick={() => setIsSelecting(!isSelecting)}
              className={`p-2 rounded-full transition-all ${
                isSelecting 
                  ? 'bg-blue-50 text-blue-600 shadow-sm' 
                  : 'text-black/60 hover:bg-black/5'
              }`}
              title="框选去除区域"
            >
              <MousePointer2 size={20} />
            </button>
            
            {(rectangles.length > 0 || currentRect) && (
              <React.Fragment>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleInpaint();
                  }}
                  className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-full transition-all ml-2"
                  title="应用去除 (填充背景)"
                >
                  <Check size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRectangles([]);
                    setCurrentRect(null);
                  }}
                  className="p-2 text-black/60 hover:bg-black/5 rounded-full transition-all"
                  title="清除选区"
                >
                  <RefreshCw size={20} />
                </button>
              </React.Fragment>
            )}
          </div>

          {selectedId && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 rounded-full border border-black/5">
                <Palette size={16} className="text-black/60" />
                <span className="text-xs font-medium text-black/70">改色:</span>
                {PRESET_COLORS.map(({ name, value }) => {
                  const logo = logoItems.find(l => l.id === selectedId);
                  const isActive = logo?.logoColor === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleLogoColor(isActive ? undefined : value)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        isActive ? 'border-black scale-110 ring-2 ring-black/20' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: value }}
                      title={name}
                    />
                  );
                })}
                <label
                  className="relative w-6 h-6 rounded-full border-2 border-dashed border-black/30 hover:border-black/60 cursor-pointer overflow-hidden flex-shrink-0 block bg-gradient-to-br from-red-400 via-green-400 to-blue-500"
                  title="自选任意颜色"
                >
                  <input
                    type="color"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => handleLogoColor(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleLogoColor(undefined)}
                  className="text-xs text-black/50 hover:text-black/80 px-1"
                  title="恢复原色"
                >
                  原色
                </button>
              </div>
              <button 
                onClick={handleInvert}
                className="flex items-center gap-2 px-4 py-2 text-black/80 hover:bg-black/5 rounded-full transition-colors text-sm font-bold"
              >
                <SunMoon size={16} />
                反相颜色
              </button>
              <button 
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full transition-colors text-sm font-bold"
              >
                <Trash2 size={16} />
                删除 Logo
              </button>
            </div>
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
              if (isSelecting) {
                const pos = e.target.getStage().getPointerPosition();
                dragStartRef.current = { x: pos.x, y: pos.y };
                setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
              }
            }}
            onMouseMove={(e) => {
              if (isSelecting && dragStartRef.current) {
                const stage = e.target.getStage();
                const pos = stage.getPointerPosition();
                const start = dragStartRef.current;
                const x = Math.min(start.x, pos.x);
                const y = Math.min(start.y, pos.y);
                const width = Math.abs(pos.x - start.x);
                const height = Math.abs(pos.y - start.y);
                setCurrentRect({ x, y, width, height });
              }
            }}
            onMouseUp={(e) => {
              if (isSelecting && dragStartRef.current) {
                const stage = e.target.getStage();
                const pos = stage.getPointerPosition();
                const start = dragStartRef.current;
                const x = Math.min(start.x, pos.x);
                const y = Math.min(start.y, pos.y);
                const width = Math.abs(pos.x - start.x);
                const height = Math.abs(pos.y - start.y);
                if (width > 5 && height > 5) {
                  setRectangles(prev => [...prev, { x, y, width, height }]);
                }
                setCurrentRect(null);
                dragStartRef.current = null;
              }
            }}
            style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
          >
            <Layer>
              {(displayImg || productImg) && (
                <KonvaImage
                  image={displayImg || productImg}
                  x={productDisplaySize.x}
                  y={productDisplaySize.y}
                  width={productDisplaySize.width}
                  height={productDisplaySize.height}
                  listening={false}
                />
              )}
              {rectangles.map((r, i) => (
                <Rect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  stroke="rgba(59, 130, 246, 0.8)"
                  strokeWidth={2}
                  dash={[6, 4]}
                  fill="rgba(59, 130, 246, 0.15)"
                  listening={false}
                />
              ))}
              {currentRect && currentRect.width > 0 && currentRect.height > 0 && (
                <Rect
                  x={currentRect.x}
                  y={currentRect.y}
                  width={currentRect.width}
                  height={currentRect.height}
                  stroke="rgba(59, 130, 246, 0.9)"
                  strokeWidth={2}
                  dash={[6, 4]}
                  fill="rgba(59, 130, 246, 0.2)"
                  listening={false}
                />
              )}
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
          </Stage>

          {/* Instructions Overlay */}
          <div className="absolute bottom-6 left-6 pointer-events-none flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <MousePointer2 size={12} /> 点击选区工具，在图片上拖拽框选需去除的区域
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <Move size={12} /> 拖动调整 Logo 位置
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <Maximize size={12} /> 使用手柄缩放 Logo 大小
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-black/40 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-black/5">
              <Palette size={12} /> 选中 Logo 后点击色块可改为纯色
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
