/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Plus, Check, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Editor from './components/Editor';

type Step = 'upload' | 'edit';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [logos, setLogos] = useState<string[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleProductDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProductImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setLogos(prev => [...prev, event.target?.result as string]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProductImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setLogos(prev => [...prev, event.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeLogo = (index: number) => {
    setLogos(prev => prev.filter((_, i) => i !== index));
  };

  const canProceed = productImage && logos.length > 0;

  if (step === 'edit' && productImage) {
    return (
      <Editor 
        productImage={productImage} 
        logos={logos} 
        onBack={() => setStep('upload')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <nav className="px-8 py-6 flex justify-between items-center border-b border-[#141414]/5 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center text-white font-bold text-lg">M</div>
          <span className="text-2xl font-bold tracking-tight">效果图工作室</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium opacity-60">
          <span className="font-bold">01 上传</span>
          <span className="opacity-20">/</span>
          <span>02 设计</span>
          <span className="opacity-20">/</span>
          <span>03 导出</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Left: Product Upload */}
          <section className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold">产品图片</h2>
              <p className="text-black/50 text-sm font-normal">上传您想要作为底图的产品图片。</p>
            </div>
            
            <div className="relative group">
              <label 
                onDragOver={handleDragOver}
                onDrop={handleProductDrop}
                className={`
                relative flex flex-col items-center justify-center w-full aspect-[4/3] rounded-3xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                ${productImage ? 'border-transparent bg-white shadow-xl' : 'border-[#141414]/10 hover:border-[#141414]/30 bg-white/50 hover:bg-white'}
              `}>
                {productImage ? (
                  <img src={productImage} alt="Product" className="w-full h-full object-contain p-4 pointer-events-none" />
                ) : (
                  <div className="flex flex-col items-center gap-4 pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-[#141414]/5 flex items-center justify-center text-[#141414]/40 group-hover:scale-110 transition-transform">
                      <ImageIcon size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">点击或拖拽上传产品图</p>
                      <p className="text-xs text-black/40 mt-1">支持 PNG, JPG 或 WEBP (最大 10MB)</p>
                    </div>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleProductUpload} />
              </label>
              {productImage && (
                <button 
                  onClick={() => setProductImage(null)}
                  className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors text-red-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </section>

          {/* Right: Logo Upload */}
          <section className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold">Logo 图片</h2>
              <p className="text-black/50 text-sm font-normal">添加一个或多个 Logo。背景将被自动移除。</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {logos.map((logo, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative aspect-square bg-white rounded-2xl border border-[#141414]/5 shadow-sm flex items-center justify-center p-4 group"
                  >
                    <img src={logo} alt={`Logo ${index}`} className="max-w-full max-h-full object-contain" />
                    <button 
                      onClick={() => removeLogo(index)}
                      className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <label 
                onDragOver={handleDragOver}
                onDrop={handleLogoDrop}
                className="aspect-square rounded-2xl border-2 border-dashed border-[#141414]/10 hover:border-[#141414]/30 bg-white/50 hover:bg-white transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-[#141414]/5 flex items-center justify-center text-[#141414]/40 group-hover:rotate-90 transition-transform pointer-events-none">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold text-black/40 pointer-events-none">点击或拖拽 Logo</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleLogoUpload} />
              </label>
            </div>
          </section>
        </div>

        {/* Footer Action */}
        <div className="mt-16 flex justify-center">
          <button
            disabled={!canProceed}
            onClick={() => setStep('edit')}
            className={`
              flex items-center gap-3 px-12 py-4 rounded-full text-xl font-bold transition-all
              ${canProceed 
                ? 'bg-[#141414] text-white shadow-2xl shadow-black/20 hover:scale-105 active:scale-95' 
                : 'bg-black/5 text-black/20 cursor-not-allowed'}
            `}
          >
            生成效果图
            <ArrowRight size={24} />
          </button>
        </div>
      </main>

      {/* Background Decorative Element */}
      <div className="fixed top-0 right-0 -z-10 opacity-10 pointer-events-none">
        <div className="text-[40vw] font-bold leading-none select-none">工作室</div>
      </div>
    </div>
  );
}
