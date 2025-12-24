import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, X, Image, Film, File, Box, CheckCircle, 
  Loader2, Sparkles, FileCode, FileText, Trash2, Plus, Wand2
} from 'lucide-react';
import BackgroundRemovalEditor from './media/BackgroundRemovalEditor';
import { ImageAnalyzer } from '../../../Packages/anti-trafficking/src/ImageAnalyzer';

interface UploadedFile {
  file: File;
  preview: string | null;
  id: string;
}

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], convert3D: boolean, hdQuality?: boolean) => void;
}

const ACCEPTED_MEDIA_TYPES = 'image/*,video/*';
const ACCEPTED_DOCUMENT_TYPES = '.md,.js,.ts,.jsx,.tsx,.json,.html,.css,.yaml,.yml,.cpp,.c,.h,.circom,.asm,.py,.rs,.go,.pdf,.txt';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({ 
  isOpen, 
  onClose, 
  onUpload 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [convert3D, setConvert3D] = useState(false);
  const [hdQuality, setHdQuality] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'media' | 'document'>('media');
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [bgRemovalTarget, setBgRemovalTarget] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setFileSizeError(null);
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setFileSizeError(`${oversizedFiles.length} file(s) exceed 50MB limit`);
    }
    
    const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE);
    const newFiles: UploadedFile[] = validFiles.map(file => {
      let preview: string | null = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        preview = URL.createObjectURL(file);
      }
      return { file, preview, id: generateId() };
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    
    setFileSizeError(null);
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setFileSizeError(`${oversizedFiles.length} file(s) exceed 50MB limit`);
    }
    
    const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE);
    const newFiles: UploadedFile[] = validFiles.map(file => {
      let preview: string | null = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        preview = URL.createObjectURL(file);
      }
      return { file, preview, id: generateId() };
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    await new Promise(res => setTimeout(res, 300));
    
    onUpload(uploadedFiles.map(f => f.file), convert3D, hdQuality);
    
    uploadedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    setUploadedFiles([]);
    setConvert3D(false);
    setHdQuality(false);
    setFileSizeError(null);
    setIsUploading(false);
    onClose();
  }, [uploadedFiles, convert3D, hdQuality, onUpload, onClose]);

  const handleClose = useCallback(() => {
    uploadedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setUploadedFiles([]);
    setConvert3D(false);
    onClose();
  }, [uploadedFiles, onClose]);

  const hasMedia = uploadedFiles.some(f => 
    f.file.type.startsWith('image/') || f.file.type.startsWith('video/')
  );

  const hasImages = uploadedFiles.some(f => f.file.type.startsWith('image/'));

  const handleBackgroundRemovalComplete = useCallback(async ({ imageBlob, maskBlob }: { imageBlob: Blob; maskBlob: Blob }) => {
    if (!bgRemovalTarget) return;

    try {
      const analysis = await ImageAnalyzer.analyzeProcessedImage(
        bgRemovalTarget.file,
        imageBlob,
        maskBlob
      );
      
      console.log('[BackgroundRemoval] Image analysis:', {
        hadBackgroundRemoved: analysis.hadBackgroundRemoved,
        removalMethod: analysis.removalMethod,
        riskScore: analysis.riskScore,
        suspiciousPatterns: analysis.suspiciousPatterns
      });

      if (analysis.riskScore > 0.7) {
        console.warn('[BackgroundRemoval] High risk score detected:', analysis.riskScore);
      }
    } catch (error) {
      console.error('[BackgroundRemoval] Analysis failed:', error);
    }

    const processedFile = new window.File([imageBlob], bgRemovalTarget.file.name.replace(/\.[^.]+$/, '_processed.png'), {
      type: 'image/png'
    });

    const newPreview = URL.createObjectURL(processedFile);

    setUploadedFiles(prev => prev.map(f => {
      if (f.id === bgRemovalTarget.id) {
        if (f.preview) URL.revokeObjectURL(f.preview);
        return { ...f, file: processedFile, preview: newPreview };
      }
      return f;
    }));

    setBgRemovalTarget(null);
  }, [bgRemovalTarget]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image size={14} className="text-[#00f3ff]" />;
    if (file.type.startsWith('video/')) return <Film size={14} className="text-[#00f3ff]" />;
    if (file.name.match(/\.(js|ts|jsx|tsx|cpp|c|py|rs|go|circom|asm)$/i)) {
      return <FileCode size={14} className="text-[#4caf50]" />;
    }
    return <FileText size={14} className="text-[#00f3ff]/60" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#010401] border border-[#00f3ff]/30 shadow-2xl shadow-[#00f3ff]/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#00f3ff]/20">
          <div className="flex items-center gap-3">
            <Upload size={16} className="text-[#00f3ff]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00f3ff]">
              UPLOAD_MEDIA
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#00f3ff]/40 hover:text-[#00f3ff] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-[#00f3ff]/20">
          <button
            onClick={() => setUploadMode('media')}
            className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all ${
              uploadMode === 'media' 
                ? 'bg-[#00f3ff]/10 text-[#00f3ff] border-b-2 border-[#00f3ff]' 
                : 'text-[#00f3ff]/40 hover:text-[#00f3ff]/60'
            }`}
          >
            Images / Videos
          </button>
          <button
            onClick={() => setUploadMode('document')}
            className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all ${
              uploadMode === 'document' 
                ? 'bg-[#4caf50]/10 text-[#4caf50] border-b-2 border-[#4caf50]' 
                : 'text-[#4caf50]/40 hover:text-[#4caf50]/60'
            }`}
          >
            Documents / Code
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            accept={uploadMode === 'media' ? ACCEPTED_MEDIA_TYPES : ACCEPTED_DOCUMENT_TYPES}
            className="hidden"
          />

          {uploadedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#00f3ff]/30 rounded-lg p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#00f3ff]/60 hover:bg-[#00f3ff]/5 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-[#00f3ff]/10 flex items-center justify-center">
                <Upload size={24} className="text-[#00f3ff]" />
              </div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-[#00f3ff] uppercase tracking-wider">
                  Drop files here or click to browse
                </div>
                <div className="text-[9px] text-[#00f3ff]/40 mt-2">
                  {uploadMode === 'media' 
                    ? 'Multiple images and videos supported' 
                    : 'Code files: .md, .js, .ts, .cpp, .circom, .json, .yaml'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {uploadedFiles.map((item) => (
                  <div 
                    key={item.id}
                    className="relative group bg-black/50 border border-[#00f3ff]/20 rounded overflow-hidden"
                  >
                    {item.preview ? (
                      item.file.type.startsWith('video/') ? (
                        <video
                          src={item.preview}
                          className="w-full h-20 object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={item.preview}
                          alt={item.file.name}
                          className="w-full h-20 object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-black/70">
                        {getFileIcon(item.file)}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                      <div className="text-[8px] text-[#00f3ff] truncate flex items-center gap-1">
                        {getFileIcon(item.file)}
                        {item.file.name}
                      </div>
                      <div className="text-[7px] text-[#00f3ff]/40">
                        {(item.file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(item.id)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} className="text-white" />
                    </button>
                    {item.file.type.startsWith('image/') && (
                      <button
                        onClick={() => setBgRemovalTarget(item)}
                        className="absolute top-1 left-1 w-5 h-5 bg-[#00f3ff]/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove background"
                      >
                        <Wand2 size={10} className="text-black" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 border-2 border-dashed border-[#00f3ff]/20 rounded flex items-center justify-center hover:border-[#00f3ff]/40 hover:bg-[#00f3ff]/5 transition-all"
                >
                  <Plus size={20} className="text-[#00f3ff]/40" />
                </button>
              </div>

              <div className="flex items-center gap-2 p-2 bg-black/30 rounded text-[9px] text-[#00f3ff]/60">
                <span>{uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} selected</span>
                <span className="text-[#00f3ff]/30">|</span>
                <span>{(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB total</span>
              </div>

              {fileSizeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[9px]" role="alert">
                  {fileSizeError}
                </div>
              )}

              {hasImages && (
                <div className="mb-3">
                  <button
                    onClick={() => {
                      const firstImage = uploadedFiles.find(f => f.file.type.startsWith('image/'));
                      if (firstImage) setBgRemovalTarget(firstImage);
                    }}
                    className="w-full flex items-center gap-4 p-3 border rounded transition-all bg-black/30 border-[#00f3ff]/20 text-[#00f3ff]/60 hover:border-[#00f3ff]/40 hover:bg-[#00f3ff]/5"
                  >
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-black/50">
                      <Wand2 size={16} className="text-[#00f3ff]/60" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[9px] font-bold uppercase tracking-wider">
                        REMOVE BACKGROUND
                      </div>
                      <div className="text-[7px] opacity-60">
                        Client-side processing - no AI/ML required
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {hasMedia && (
                <div className="space-y-3">
                  <button
                    onClick={() => setHdQuality(!hdQuality)}
                    className={`w-full flex items-center gap-4 p-3 border rounded transition-all ${
                      hdQuality
                        ? 'bg-[#4caf50]/10 border-[#4caf50]/60 text-[#4caf50]'
                        : 'bg-black/30 border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/30'
                    }`}
                    aria-pressed={hdQuality}
                    aria-label="Send in HD quality"
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-[10px] ${
                      hdQuality ? 'bg-[#4caf50]/20 text-[#4caf50]' : 'bg-black/50 text-[#4caf50]/40'
                    }`}>
                      HD
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[9px] font-bold uppercase tracking-wider">
                        SEND IN HD QUALITY
                      </div>
                      <div className="text-[7px] opacity-60">
                        Preserve original quality (larger file size)
                      </div>
                    </div>
                    {hdQuality && (
                      <CheckCircle size={16} className="text-[#4caf50]" />
                    )}
                  </button>

                  <button
                    onClick={() => setConvert3D(!convert3D)}
                    className={`w-full flex items-center gap-4 p-3 border rounded transition-all ${
                      convert3D
                        ? 'bg-[#00f3ff]/10 border-[#00f3ff]/60 text-[#00f3ff]'
                        : 'bg-black/30 border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#00f3ff]/30'
                    }`}
                    aria-pressed={convert3D}
                    aria-label="Convert to 3D tensor object"
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      convert3D ? 'bg-[#00f3ff]/20' : 'bg-black/50'
                    }`}>
                      <Box size={16} className={convert3D ? 'text-[#00f3ff]' : 'text-[#4caf50]/40'} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[9px] font-bold uppercase tracking-wider">
                        CONVERT TO 3D TENSOR OBJECT
                      </div>
                      <div className="text-[7px] opacity-60">
                        Render as interactive 3D via Flower of Life PHI
                      </div>
                    </div>
                    {convert3D && (
                      <Sparkles size={16} className="text-[#00f3ff] animate-pulse" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[#00f3ff]/20">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-black/50 border border-[#4caf50]/20 text-[#4caf50]/60 text-[9px] font-bold uppercase tracking-wider hover:bg-black/70 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploadedFiles.length === 0 || isUploading}
            className="flex-1 py-3 bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-[9px] font-bold uppercase tracking-wider hover:bg-[#00f3ff]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                PROCESSING...
              </>
            ) : (
              <>
                <CheckCircle size={12} />
                {convert3D ? 'SEND_3D_OBJECT' : 'SEND_MEDIA'}
              </>
            )}
          </button>
        </div>
      </div>

      {bgRemovalTarget && (
        <BackgroundRemovalEditor
          originalImage={bgRemovalTarget.file}
          onComplete={handleBackgroundRemovalComplete}
          onCancel={() => setBgRemovalTarget(null)}
        />
      )}
    </div>
  );
};

export default FileUploadDialog;
