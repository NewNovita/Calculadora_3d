import React, { useState, useEffect, useMemo, useRef } from 'react';

const STORAGE_KEY_PRINTERS = 'calc3d_printer_profiles_v1';
const STORAGE_KEY_THEME = 'calc3d_theme_mode_v1';

const DEFAULT_PRINTER_PROFILES = [
  {
    id: 'ender3-std',
    name: 'Estándar (Ej. Ender 3)',
    watts: 150,
    wearRate: 0.2,
    isDefault: true,
  },
  {
    id: 'bambu-x1c',
    name: 'Alta Velocidad (Ej. Bambu Lab X1C)',
    watts: 350,
    wearRate: 0.5,
    isDefault: true,
  },
];

const DEFAULT_PDF_SETTINGS = {
  showMaterial: true,
  showLabor: true,
  showMachineWear: true,
  showElectricity: true,
  showExtras: true,
  showProfitMargin: true,
};

/**
 * Carga dinámicamente html2canvas y jsPDF (desde paquete NPM o CDN como respaldo)
 */
async function loadPdfLibraries() {
  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });

  let html2canvasFn = typeof window !== 'undefined' ? window.html2canvas : null;
  let jsPDFClass =
    typeof window !== 'undefined' && window.jspdf ? window.jspdf.jsPDF : null;

  if (!html2canvasFn) {
    try {
      const mod = await import('html2canvas');
      html2canvasFn = mod.default || mod;
    } catch {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      );
      html2canvasFn = window.html2canvas;
    }
  }

  if (!jsPDFClass) {
    try {
      const mod = await import('jspdf');
      jsPDFClass = mod.jsPDF || mod.default;
    } catch {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      );
      jsPDFClass = window.jspdf.jsPDF;
    }
  }

  return { html2canvas: html2canvasFn, jsPDF: jsPDFClass };
}

/**
 * Dibuja de forma síncrona el gráfico de anillo en un elemento <canvas>.
 * Soporta tema claro (para el PDF formal o Modo Claro) y tema oscuro (para Modo Oscuro).
 */
function drawDoughnutCanvas(
  canvas,
  items,
  total,
  currency,
  isDark = false,
  centerLabel = 'COSTO BASE'
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = 2;
  const size = 140;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = 52;
  const lineWidth = 18;

  // Fondo del anillo
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (total > 0) {
    let startAngle = -Math.PI / 2;
    items.forEach((item) => {
      const sliceAngle = (item.value / total) * (Math.PI * 2);
      if (sliceAngle > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        startAngle += sliceAngle;
      }
    });
  }

  // Texto central
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = '600 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(centerLabel, cx, cy - 4);

  ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
  ctx.font = '700 13px monospace';
  ctx.fillText(`${currency}${total.toFixed(2)}`, cx, cy + 12);

  ctx.restore();
}

/**
 * Componente de Gráfico de Anillo (basado en Canvas síncrono)
 */
function CostDoughnutChart({
  items,
  total,
  currency,
  isDark = false,
  canvasRef,
  centerLabel = 'COSTO BASE',
}) {
  const internalRef = useRef(null);
  const activeRef = canvasRef || internalRef;

  useEffect(() => {
    drawDoughnutCanvas(activeRef.current, items, total, currency, isDark, centerLabel);
  }, [items, total, currency, isDark, activeRef, centerLabel]);

  return (
    <div className="flex items-center justify-center">
      <canvas ref={activeRef} width={140} height={140} />
    </div>
  );
}

/**
 * Tarjeta contenedora para secciones del formulario (Estilo SaaS Corporativo Stripe / Vercel)
 */
function SectionCard({ step, title, subtitle, badge, rightAction, accent = 'emerald', children }) {
  const accentMap = {
    blue: 'bg-blue-50/80 text-blue-600 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    emerald:
      'bg-emerald-50/80 text-emerald-600 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    indigo:
      'bg-indigo-50/80 text-indigo-600 border-indigo-200/80 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    amber:
      'bg-amber-50/80 text-amber-600 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    rose: 'bg-rose-50/80 text-rose-600 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono font-bold text-sm shadow-xs ${
              accentMap[accent] || accentMap.emerald
            }`}
          >
            {step}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {badge && (
          <span className="text-[11px] font-mono font-semibold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            {badge}
          </span>
        )}
        {rightAction}
      </div>
      {children}
    </div>
  );
}

/**
 * Campo numérico estilizado con padding-right amplio y dinámico
 * para evitar que los números o spin-buttons se superpongan con el sufijo.
 */
function NumberField({ label, value, onChange, prefix, suffix, step = '0.1', min = '0' }) {
  // Calcula un padding-right holgado según la longitud del texto del sufijo
  const getRightPaddingClass = () => {
    if (!suffix) return 'pr-4';
    if (suffix.length >= 6) return 'pr-24'; // Ej. "por hora", "/ 1000g", "/ 1000ml", "gramos"
    if (suffix.length >= 3) return 'pr-16'; // Ej. "hrs", "min", "kWh"
    return 'pr-14'; // Ej. "/h", "W", "%", "ml"
  };

  // Ajusta el padding-left si el prefijo es "S/" (2 caracteres) o "$" (1 carácter)
  const getLeftPaddingClass = () => {
    if (!prefix) return 'pl-4';
    return prefix.length > 1 ? 'pl-10' : 'pl-8';
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 font-mono text-xs font-semibold pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 py-2.5 text-sm font-mono font-medium text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200 ${getLeftPaddingClass()} ${getRightPaddingClass()}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-slate-400 font-mono font-medium pointer-events-none select-none bg-gray-100/90 dark:bg-slate-800/90 px-1.5 py-0.5 rounded-md">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Modal para crear y gestionar perfiles de impresoras
 */
function PrinterManagerModal({
  isOpen,
  onClose,
  profiles,
  currency,
  onSelectProfile,
  onAddProfile,
  onDeleteProfile,
}) {
  const [name, setName] = useState('');
  const [watts, setWatts] = useState('');
  const [wearRate, setWearRate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedWatts = parseFloat(watts);
    const parsedWear = parseFloat(wearRate);
    if (!name.trim() || isNaN(parsedWatts) || parsedWatts < 0 || isNaN(parsedWear) || parsedWear < 0) {
      return;
    }
    onAddProfile({
      id: `printer-${Date.now()}`,
      name: name.trim(),
      watts: parsedWatts,
      wearRate: parsedWear,
      isDefault: false,
    });
    setName('');
    setWatts('');
    setWearRate('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 dark:bg-slate-950/75 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Gestionar Perfiles de Impresoras
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Guarda tus máquinas en el navegador (localStorage)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors duration-200"
          >
            ✕
          </button>
        </div>

        <div className="my-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
            Perfiles Guardados
          </h4>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {profiles.length === 0 ? (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-950/60 border border-dashed border-gray-200 dark:border-gray-800 text-center">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  No hay perfiles de impresora registrados
                </p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                  Agrega un perfil usando el formulario inferior o recarga la página para restaurar los perfiles por defecto.
                </p>
              </div>
            ) : (
              profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 dark:bg-slate-950/60 border border-gray-200/80 dark:border-gray-800"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">{p.name}</div>
                    <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 mt-0.5">
                      Consumo:{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {p.watts}W
                      </span>{' '}
                      • Desgaste:{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {currency}
                        {Number(p.wearRate).toFixed(2)}/h
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProfile(p.id);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:border-emerald-500/30 transition-colors duration-200"
                    >
                      Usar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(p.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15 transition-colors duration-200 font-bold"
                      title="Eliminar perfil"
                      aria-label={`Eliminar perfil ${p.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="pt-5 border-t border-gray-100 dark:border-gray-800 space-y-4"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Agregar Nueva Impresora
          </h4>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Nombre del Perfil / Máquina
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Prusa MK4 / Creality K1 / Elegoo Saturn"
              className="w-full rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Consumo medio (Watts)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={watts}
                onChange={(e) => setWatts(e.target.value)}
                placeholder="Ej. 220"
                className="w-full rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm font-mono text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Desgaste por hora ({currency}/h)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={wearRate}
                onChange={(e) => setWearRate(e.target.value)}
                placeholder="Ej. 0.35"
                className="w-full rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 text-sm font-mono text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all duration-200 shadow-sm hover:shadow-md"
            >
              + Guardar Perfil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Componente Principal: Calculadora de Costos de Impresión 3D
 */
export default function CalculadoraCostos3D() {
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Referencia exacta al contenedor del presupuesto PDF (#pdf-budget-container)
  const pdfContainerRef = useRef(null);
  const pdfChartCanvasRef = useRef(null);

  // Estado Modo Claro / Modo Oscuro (Theme Toggle)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, darkMode ? 'dark' : 'light');
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', darkMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  // Perfiles de Impresora (con persistencia en localStorage)
  const [printerProfiles, setPrinterProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRINTERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error cargando perfiles desde localStorage:', e);
    }
    return DEFAULT_PRINTER_PROFILES;
  });

  const [selectedPrinterId, setSelectedPrinterId] = useState('ender3-std');
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  // Notificación amigable (Toast)
  const [notification, setNotification] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setNotification({ title, message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.title === title ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRINTERS, JSON.stringify(printerProfiles));
    } catch (e) {
      console.warn('Error guardando perfiles en localStorage:', e);
    }
  }, [printerProfiles]);

  // Estados del Formulario
  const [currency, setCurrency] = useState('$');
  const [partName, setPartName] = useState('Soporte Articulado Pro');
  const [technology, setTechnology] = useState('FDM'); // 'FDM' | 'SLA'
  const [modelImage, setModelImage] = useState(null); // Base64 DataURL del render 3D

  // 2. Material
  const [materialCost, setMaterialCost] = useState(22);
  const [materialUsed, setMaterialUsed] = useState(85);

  // 3. Tiempos y Mano de Obra
  const [printHours, setPrintHours] = useState(4);
  const [printMinutes, setPrintMinutes] = useState(30);
  const [laborMinutes, setLaborMinutes] = useState(20);
  const [laborRate, setLaborRate] = useState(10);

  // 4. Desgaste y Electricidad
  const [machineWearRate, setMachineWearRate] = useState(0.2);
  const [powerWatts, setPowerWatts] = useState(150);
  const [electricityRate, setElectricityRate] = useState(0.18);

  // 5. Extras Dinámicos e Impuestos
  const [extrasList, setExtrasList] = useState([
    { id: 1, nombre: 'Caja premium', costo: 1.5 },
  ]);
  const [extraNombreInput, setExtraNombreInput] = useState('');
  const [extraCostoInput, setExtraCostoInput] = useState('');
  const [taxPercent, setTaxPercent] = useState(16);

  // Estrategia de Precios & Opciones Granulares de Exportación PDF
  const [selectedTier, setSelectedTier] = useState('40');
  const [customMargin, setCustomMargin] = useState(100);
  const [pdfSettings, setPdfSettings] = useState(DEFAULT_PDF_SETTINGS);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleAddExtra = () => {
    const trimmedName = extraNombreInput.trim();
    const parsedCost = parseFloat(extraCostoInput);
    if (!trimmedName || isNaN(parsedCost) || parsedCost < 0) {
      showToast(
        'Datos incompletos',
        'Por favor ingresa el nombre del extra y un costo válido.',
        'error'
      );
      return;
    }
    setExtrasList((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        nombre: trimmedName,
        costo: parsedCost,
      },
    ]);
    setExtraNombreInput('');
    setExtraCostoInput('');
  };

  const handleRemoveExtra = (id) => {
    setExtrasList((prev) => prev.filter((item) => item.id !== id));
  };

  const togglePdfSetting = (key) => {
    setPdfSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllPdfSettings = (value) => {
    setPdfSettings({
      showMaterial: value,
      showLabor: value,
      showMachineWear: value,
      showElectricity: value,
      showExtras: value,
      showProfitMargin: value,
    });
  };

  // Subida de Imagen (guardada como Base64 para compatibilidad total con html2canvas)
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Archivo inválido', 'Por favor selecciona una imagen (PNG, JPG, WEBP).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setModelImage(ev.target.result);
      showToast('Imagen cargada', 'El render del modelo 3D se incluyó en el presupuesto.');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPrinterProfile = (profileId) => {
    setSelectedPrinterId(profileId);
    const found = printerProfiles.find((p) => p.id === profileId);
    if (found) {
      setPowerWatts(found.watts);
      setMachineWearRate(found.wearRate);
    }
  };

  const handleAddPrinterProfile = (newProfile) => {
    setPrinterProfiles((prev) => [...prev, newProfile]);
    setSelectedPrinterId(newProfile.id);
    setPowerWatts(newProfile.watts);
    setMachineWearRate(newProfile.wearRate);
    showToast('Impresora agregada', `Se creó y activó el perfil "${newProfile.name}".`);
  };

  const handleDeletePrinterProfile = (profileId) => {
    setPrinterProfiles((prev) => {
      const updated = prev.filter((p) => p.id !== profileId);
      if (updated.length === 0) {
        setSelectedPrinterId('custom');
      } else if (selectedPrinterId === profileId) {
        setSelectedPrinterId(updated[0].id);
        setPowerWatts(updated[0].watts);
        setMachineWearRate(updated[0].wearRate);
      }
      return updated;
    });
    showToast('Perfil eliminado', 'El perfil de impresora fue eliminado correctamente.');
  };

  const handleSaveProject = () => {
    const rawName = partName.trim() || 'Pieza3D';
    const safeFileName = rawName
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    const projectPayload = {
      app: '3DPrintCostCalculator',
      version: '4.2',
      exportedAt: new Date().toISOString(),
      data: {
        partName: rawName,
        technology,
        currency,
        selectedPrinterId,
        materialCost,
        materialUsed,
        printHours,
        printMinutes,
        laborMinutes,
        laborRate,
        machineWearRate,
        powerWatts,
        electricityRate,
        extrasList,
        taxPercent,
        selectedTier,
        customMarginInput: customMargin,
        pdfSettings,
        modelImageDataUrl: modelImage,
      },
    };

    const blob = new Blob([JSON.stringify(projectPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName || 'Proyecto'}_cotizacion.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Proyecto guardado', `Se descargó "${safeFileName}_cotizacion.json".`);
  };

  const handleLoadProjectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const data = parsed.data || parsed;

        if (
          typeof data !== 'object' ||
          data === null ||
          (data.materialCost === undefined && data.partName === undefined)
        ) {
          throw new Error('Formato de archivo JSON inválido');
        }

        if (data.partName !== undefined) setPartName(String(data.partName));
        if (data.technology === 'FDM' || data.technology === 'SLA') setTechnology(data.technology);
        if (data.currency) setCurrency(data.currency === 'S/' ? 'S/' : '$');
        if (data.selectedPrinterId) setSelectedPrinterId(String(data.selectedPrinterId));
        if (data.materialCost !== undefined) setMaterialCost(Number(data.materialCost));
        if (data.materialUsed !== undefined) setMaterialUsed(Number(data.materialUsed));
        if (data.printHours !== undefined) setPrintHours(Number(data.printHours));
        if (data.printMinutes !== undefined) setPrintMinutes(Number(data.printMinutes));
        if (data.laborMinutes !== undefined) setLaborMinutes(Number(data.laborMinutes));
        if (data.laborRate !== undefined) setLaborRate(Number(data.laborRate));
        if (data.machineWearRate !== undefined) setMachineWearRate(Number(data.machineWearRate));
        if (data.powerWatts !== undefined) setPowerWatts(Number(data.powerWatts));
        if (data.electricityRate !== undefined) setElectricityRate(Number(data.electricityRate));
        if (Array.isArray(data.extrasList)) {
          setExtrasList(
            data.extrasList.map((item, idx) => ({
              id: item.id ?? Date.now() + idx,
              nombre: String(item.nombre || 'Extra'),
              costo: Math.max(0, Number(item.costo) || 0),
            }))
          );
        } else if (data.hardwareCost !== undefined || data.packagingCost !== undefined) {
          const migrated = [];
          if (Number(data.hardwareCost) > 0) {
            migrated.push({ id: 1, nombre: 'Hardware', costo: Number(data.hardwareCost) });
          }
          if (Number(data.packagingCost) > 0) {
            migrated.push({ id: 2, nombre: 'Embalaje', costo: Number(data.packagingCost) });
          }
          setExtrasList(migrated);
        }
        if (data.taxPercent !== undefined) setTaxPercent(Number(data.taxPercent));
        if (data.selectedTier) setSelectedTier(String(data.selectedTier));
        if (data.customMarginInput !== undefined) setCustomMargin(Number(data.customMarginInput));
        if (data.pdfSettings && typeof data.pdfSettings === 'object') {
          setPdfSettings({ ...DEFAULT_PDF_SETTINGS, ...data.pdfSettings });
        }
        setModelImage(data.modelImageDataUrl || null);

        showToast(
          'Proyecto cargado',
          `Se cargaron los datos de "${data.partName || 'Proyecto'}" correctamente.`
        );
      } catch {
        showToast(
          'Archivo JSON inválido',
          'No se pudo cargar el archivo. Asegúrate de elegir un archivo .json válido exportado por la calculadora.',
          'error'
        );
      }
    };
    reader.readAsText(file);
  };

  // Suma dinámica de todos los costos adicionales dentro de extrasList
  const totalExtrasCost = useMemo(
    () => extrasList.reduce((acc, item) => acc + Math.max(0, Number(item.costo) || 0), 0),
    [extrasList]
  );

  const calculations = useMemo(() => {
    const totalPrintHours = Math.max(0, printHours) + Math.max(0, printMinutes) / 60;
    const costMaterial = (Math.max(0, materialCost) / 1000) * Math.max(0, materialUsed);
    const costLabor = (Math.max(0, laborMinutes) / 60) * Math.max(0, laborRate);
    const costWear = totalPrintHours * Math.max(0, machineWearRate);
    const energyKwh = (Math.max(0, powerWatts) / 1000) * totalPrintHours;
    const costElectricity = energyKwh * Math.max(0, electricityRate);
    const costExtras = totalExtrasCost;

    const totalBaseCost = costMaterial + costLabor + costWear + costElectricity + totalExtrasCost;

    const computeTier = (marginPct) => {
      const profit = totalBaseCost * (marginPct / 100);
      const subtotal = totalBaseCost + profit;
      const taxAmount = subtotal * (Math.max(0, taxPercent) / 100);
      const finalPrice = subtotal + taxAmount;
      return { marginPct, profit, subtotal, taxAmount, finalPrice };
    };

    const tiers = {
      '25': computeTier(25),
      '40': computeTier(40),
      '60': computeTier(60),
      '80': computeTier(80),
      custom: computeTier(Math.max(0, customMargin)),
    };

    return {
      totalPrintHours,
      energyKwh,
      costMaterial,
      costLabor,
      costWear,
      costElectricity,
      costExtras,
      totalExtrasCost,
      totalBaseCost,
      tiers,
      activeTier: tiers[selectedTier] || tiers['40'],
    };
  }, [
    materialCost,
    materialUsed,
    printHours,
    printMinutes,
    laborMinutes,
    laborRate,
    machineWearRate,
    powerWatts,
    electricityRate,
    totalExtrasCost,
    taxPercent,
    customMargin,
    selectedTier,
  ]);

  const isFDM = technology === 'FDM';
  const activePrinterObj = printerProfiles.find((p) => p.id === selectedPrinterId);
  const unitSuffix = isFDM ? 'g' : 'ml';
  const formatMoney = (val) => `${currency}${Number(val || 0).toFixed(2)}`;

  // Lista completa de conceptos para la calculadora principal
  const chartItems = useMemo(
    () => [
      {
        key: 'showMaterial',
        label: `Costo de Material (${materialUsed}${unitSuffix})`,
        shortLabel: 'Material',
        value: calculations.costMaterial,
        color: '#059669',
      },
      {
        key: 'showLabor',
        label: `Costo de Mano de Obra (${laborMinutes} min)`,
        shortLabel: 'Mano de Obra',
        value: calculations.costLabor,
        color: '#4f46e5',
      },
      {
        key: 'showMachineWear',
        label: `Costo de Máquina / Desgaste (${calculations.totalPrintHours.toFixed(1)}h)`,
        shortLabel: 'Desgaste Máquina',
        value: calculations.costWear,
        color: '#d97706',
      },
      {
        key: 'showElectricity',
        label: `Costo de Consumo Eléctrico (${calculations.energyKwh.toFixed(2)} kWh)`,
        shortLabel: 'Electricidad',
        value: calculations.costElectricity,
        color: '#0284c7',
      },
      {
        key: 'showExtras',
        label:
          extrasList.length > 0
            ? `Costos Extras (${extrasList.map((e) => e.nombre).join(', ')})`
            : 'Costos Extras (Sin adicionales)',
        shortLabel:
          extrasList.length > 0
            ? `Extras (${extrasList.length} ${extrasList.length === 1 ? 'ítem' : 'ítems'})`
            : 'Extras',
        value: totalExtrasCost,
        color: '#e11d48',
      },
    ],
    [
      materialUsed,
      unitSuffix,
      laborMinutes,
      calculations.totalPrintHours,
      calculations.energyKwh,
      calculations.costMaterial,
      calculations.costLabor,
      calculations.costWear,
      calculations.costElectricity,
      extrasList,
      totalExtrasCost,
    ]
  );

  // Filas filtradas según los checkboxes de pdfSettings para el documento PDF
  const visiblePdfCostItems = useMemo(
    () => chartItems.filter((item) => pdfSettings[item.key]),
    [chartItems, pdfSettings]
  );

  // 1. Lógica de Agrupación de Costos Ocultos:
  // Suma automáticamente el valor monetario de todos los conceptos desmarcados (false en pdfSettings),
  // incluyendo ganancia neta, desgaste de máquina, electricidad, totalExtrasCost, material y mano de obra.
  const costosOcultosTotal = useMemo(() => {
    let totalOculto = 0;
    if (!pdfSettings.showMaterial) totalOculto += calculations.costMaterial;
    if (!pdfSettings.showLabor) totalOculto += calculations.costLabor;
    if (!pdfSettings.showMachineWear) totalOculto += calculations.costWear;
    if (!pdfSettings.showElectricity) totalOculto += calculations.costElectricity;
    if (!pdfSettings.showExtras) totalOculto += totalExtrasCost;
    if (!pdfSettings.showProfitMargin) totalOculto += calculations.activeTier.profit;
    return totalOculto;
  }, [
    pdfSettings,
    calculations.costMaterial,
    calculations.costLabor,
    calculations.costWear,
    calculations.costElectricity,
    totalExtrasCost,
    calculations.activeTier.profit,
  ]);

  // 3. Segmentos del Gráfico de Anillo del PDF:
  // Agrupa todos los conceptos desmarcados en una sola rebanada gris neutra ("Costos Operativos")
  // para que la suma visual y matemática del gráfico coincida exactamente con el Subtotal.
  const pdfChartItems = useMemo(() => {
    const slices = [...visiblePdfCostItems];

    if (pdfSettings.showProfitMargin && calculations.activeTier.profit > 0) {
      slices.push({
        key: 'showProfitMargin',
        label: `Desglose de Ganancia / Margen (+${calculations.activeTier.marginPct}%)`,
        shortLabel: 'Ganancia / Margen',
        value: calculations.activeTier.profit,
        color: '#10b981', // Esmeralda claro para distinguir del material
      });
    }

    if (costosOcultosTotal > 0) {
      slices.push({
        key: 'costosOperativosAgrupados',
        label: 'Costos Operativos, Gestión y Extras',
        shortLabel: 'Costos Operativos',
        value: costosOcultosTotal,
        color: '#94a3b8', // Gris neutro suave (Slate 400)
      });
    }

    return slices;
  }, [
    visiblePdfCostItems,
    pdfSettings.showProfitMargin,
    calculations.activeTier.profit,
    calculations.activeTier.marginPct,
    costosOcultosTotal,
  ]);

  // Exportar Presupuesto a PDF (SIEMPRE en Fondo Blanco y Texto Oscuro para documentos formales)
  const handleExportPdf = async () => {
    if (!pdfContainerRef.current) {
      showToast('Error', 'No se encontró la referencia al contenedor del presupuesto.', 'error');
      return;
    }

    setIsExportingPdf(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfLibraries();

      // 1. Asegurar que el gráfico del PDF esté renderizado con los segmentos visibles + Costos Operativos agrupados
      if (pdfChartCanvasRef.current) {
        drawDoughnutCanvas(
          pdfChartCanvasRef.current,
          pdfChartItems,
          calculations.activeTier.subtotal,
          currency,
          false,
          'SUBTOTAL'
        );
      }

      // 2. Esperar un frame de renderizado para asegurar que las imágenes estén listas
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 120)));

      // 3. Capturar #pdf-budget-container forzando fondo blanco (#ffffff)
      const canvas = await html2canvas(pdfContainerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const renderedHeight = (canvas.height * usableWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, renderedHeight);

      const safeFileName = (partName.trim() || 'Presupuesto_3D')
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u017F ]/g, '')
        .trim()
        .replace(/\s+/g, '_');

      pdf.save(`${safeFileName}_Presupuesto.pdf`);

      showToast(
        'PDF exportado con éxito',
        `Se descargó "${safeFileName}_Presupuesto.pdf" con las opciones seleccionadas.`
      );
    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Error al exportar PDF', 'No se pudo generar el documento PDF.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const pdfChecklistOptions = [
    { key: 'showMaterial', label: 'Mostrar costo de Material' },
    { key: 'showLabor', label: 'Mostrar costo de Mano de Obra' },
    { key: 'showMachineWear', label: 'Mostrar costo de Máquina (Desgaste)' },
    { key: 'showElectricity', label: 'Mostrar costo de Consumo Eléctrico' },
    { key: 'showExtras', label: 'Mostrar costos Extras (Hardware/Embalaje)' },
    { key: 'showProfitMargin', label: 'Mostrar Desglose de Ganancia / Margen' },
  ];

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50/80 dark:bg-slate-950 text-gray-800 dark:text-slate-100 pb-20 transition-colors duration-200">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md">
            <div
              className={`px-4 py-3.5 rounded-xl border shadow-lg text-xs ${
                notification.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/95 dark:border-rose-500/40 dark:text-rose-200'
                  : 'bg-white border-emerald-200 text-gray-800 dark:bg-slate-900 dark:border-emerald-500/40 dark:text-slate-100'
              }`}
            >
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                {notification.title}
              </p>
              <p className="text-gray-600 dark:text-slate-300 mt-0.5">{notification.message}</p>
            </div>
          </div>
        )}

        {/* Header / Top Toolbar Corporativo SaaS */}
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md sticky top-0 z-30 transition-colors duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-extrabold shadow-sm ring-1 ring-emerald-500/20">
                3D
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Calculadora de Costos de Impresión 3D
                </h1>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Cotizador profesional SaaS • Gestión de máquinas y exportación PDF
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Selector de Moneda: Únicamente Soles (PEN - S/) y Dólares (USD - $) */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Seleccionar divisa"
                className="bg-gray-50 dark:bg-slate-800/90 border border-gray-200 dark:border-gray-700 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-emerald-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200 cursor-pointer"
              >
                <option value="S/">Soles (PEN - S/)</option>
                <option value="$">Dólares (USD - $)</option>
              </select>

              {/* Guardar Proyecto */}
              <button
                type="button"
                onClick={handleSaveProject}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-gray-700 transition-colors duration-200"
              >
                <span>💾 Guardar Proyecto</span>
              </button>

              {/* Cargar Proyecto */}
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-gray-700 transition-colors duration-200"
              >
                <span>📂 Cargar Proyecto</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleLoadProjectFile}
                className="hidden"
              />

              {/* Botón Modo Claro / Modo Oscuro con lógica corregida */}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200/80 text-gray-800 border border-gray-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:text-slate-100 dark:border-gray-700 transition-colors duration-200"
                title={
                  darkMode
                    ? 'Cambiar a Modo Claro'
                    : 'Cambiar a Modo Oscuro'
                }
              >
                <span>{darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content con mayor respiro (whitespace) */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* COLUMNA IZQUIERDA: INPUTS */}
            <section className="lg:col-span-7 space-y-8">
              {/* 1. Información General y Subida de Render 3D */}
              <SectionCard
                step="1"
                title="Información General"
                subtitle="Nombre de la pieza, tecnología y captura o render del modelo 3D"
                accent="blue"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-7">
                  <div>
                    <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2">
                      Nombre de la pieza / proyecto
                    </label>
                    <input
                      type="text"
                      value={partName}
                      onChange={(e) => setPartName(e.target.value)}
                      placeholder="Ej. Engranaje Helicoidal"
                      className="w-full rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2">
                      Tecnología de impresión
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100/80 dark:bg-slate-900/60 rounded-lg border border-gray-200/80 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => setTechnology('FDM')}
                        className={`py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${
                          isFDM
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        FDM (Filamento)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTechnology('SLA')}
                        className={`py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${
                          !isFDM
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        SLA (Resina)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subida y Vista Previa (Thumbnail) del Render 3D */}
                <div>
                  <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2.5">
                    Captura o Render del Modelo 3D (Vista previa para la interfaz y el PDF)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {modelImage ? (
                        <img
                          src={modelImage}
                          alt="Thumbnail del modelo 3D"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500 text-center px-2">
                          Sin render
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 mb-1">
                        Sube una imagen o captura de tu laminador 3D
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3.5">
                        Se mostrará en la vista previa y de forma destacada en el presupuesto PDF.
                      </p>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="block w-full sm:w-auto text-xs text-gray-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:transition-colors file:duration-200 file:cursor-pointer cursor-pointer"
                        />
                        {modelImage && (
                          <button
                            type="button"
                            onClick={() => {
                              setModelImage(null);
                              if (imageInputRef.current) imageInputRef.current.value = '';
                            }}
                            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:text-rose-300 dark:border-rose-500/30 transition-colors duration-200"
                          >
                            Quitar imagen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* 2. Material */}
              <SectionCard
                step="2"
                title="Material y Consumo"
                subtitle="Precio por bobina/botella y peso/volumen estimado en el laminador"
                badge={isFDM ? 'Bobina 1 kg' : 'Botella 1 L'}
                accent="emerald"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <NumberField
                    label={
                      isFDM
                        ? `Costo del filamento por kg (${currency})`
                        : `Costo de resina por Litro (${currency})`
                    }
                    value={materialCost}
                    onChange={setMaterialCost}
                    prefix={currency}
                    suffix={isFDM ? '/ 1000g' : '/ 1000ml'}
                  />
                  <NumberField
                    label={isFDM ? 'Cantidad utilizada (gramos)' : 'Cantidad utilizada (ml)'}
                    value={materialUsed}
                    onChange={setMaterialUsed}
                    suffix={isFDM ? 'gramos' : 'ml'}
                    step="1"
                  />
                </div>
              </SectionCard>

              {/* 3. Tiempos y Mano de Obra */}
              <SectionCard
                step="3"
                title="Tiempos y Mano de Obra"
                subtitle="Duración de impresión y post-procesado manual"
                accent="indigo"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2">
                      Tiempo de impresión
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <NumberField
                        value={printHours}
                        onChange={setPrintHours}
                        suffix="hrs"
                        step="1"
                      />
                      <NumberField
                        value={printMinutes}
                        onChange={setPrintMinutes}
                        suffix="min"
                        step="1"
                      />
                    </div>
                  </div>
                  <NumberField
                    label="Tiempo de mano de obra (minutos)"
                    value={laborMinutes}
                    onChange={setLaborMinutes}
                    suffix="min"
                    step="5"
                  />
                  <div className="sm:col-span-2">
                    <NumberField
                      label={`Tarifa de mano de obra por hora (${currency}/h)`}
                      value={laborRate}
                      onChange={setLaborRate}
                      prefix={currency}
                      suffix="por hora"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* 4. Desgaste de Máquina y Electricidad */}
              <SectionCard
                step="4"
                title="Desgaste de Máquina y Electricidad"
                subtitle="Selecciona un perfil de impresora o ajusta sus parámetros"
                accent="amber"
                rightAction={
                  <button
                    type="button"
                    onClick={() => setIsPrinterModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/30 transition-colors duration-200"
                  >
                    + Gestionar Impresoras
                  </button>
                }
              >
                <div className="mb-6 p-4 rounded-xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-200/80 dark:border-gray-800">
                  <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-amber-300 mb-2">
                    Perfil de Impresora
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedPrinterId}
                      onChange={(e) => handleSelectPrinterProfile(e.target.value)}
                      className="flex-1 rounded-lg bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-sm font-medium text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all duration-200"
                    >
                      {printerProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.watts}W | {currency}
                          {Number(p.wearRate).toFixed(2)}/h
                        </option>
                      ))}
                      <option value="custom">⚙️ Personalizado (Valores manuales)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsPrinterModalOpen(true)}
                      className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-emerald-700 border border-gray-200 shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-emerald-400 dark:border-gray-700 transition-colors duration-200"
                    >
                      + Nuevo Perfil
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <NumberField
                    label={`Desgaste (${currency}/h)`}
                    value={machineWearRate}
                    onChange={(val) => {
                      setMachineWearRate(val);
                      setSelectedPrinterId('custom');
                    }}
                    prefix={currency}
                    suffix="/h"
                    step="0.05"
                  />
                  <NumberField
                    label="Consumo medio (Watts)"
                    value={powerWatts}
                    onChange={(val) => {
                      setPowerWatts(val);
                      setSelectedPrinterId('custom');
                    }}
                    suffix="W"
                    step="10"
                  />
                  <NumberField
                    label={`Costo kWh (${currency})`}
                    value={electricityRate}
                    onChange={setElectricityRate}
                    prefix={currency}
                    suffix="kWh"
                    step="0.01"
                  />
                </div>
              </SectionCard>

              {/* 5. Extras, Embalaje e Impuestos */}
              <SectionCard
                step="5"
                title="Extras, Embalaje e Impuestos"
                subtitle="Agrega costos adicionales personalizables (imanes, pintura, embalaje) e IVA"
                badge={`Extras: ${currency}${totalExtrasCost.toFixed(2)}`}
                accent="rose"
              >
                <div className="space-y-6">
                  {/* Input de Impuestos / IVA (%) intacto */}
                  <div className="max-w-xs">
                    <NumberField
                      label="Impuestos / IVA (%)"
                      value={taxPercent}
                      onChange={setTaxPercent}
                      suffix="%"
                      step="1"
                    />
                  </div>

                  {/* Formulario en línea para añadir nuevos extras */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold tracking-tight text-gray-700 dark:text-slate-300 mb-2.5">
                      Agregar Costos Adicionales / Extras
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1">
                          Nombre del Extra
                        </label>
                        <input
                          type="text"
                          value={extraNombreInput}
                          onChange={(e) => setExtraNombreInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExtra();
                            }
                          }}
                          placeholder="Ej. Imanes, Pintura, Pegamento"
                          className="w-full rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-medium text-gray-500 dark:text-slate-400 mb-1">
                          Costo ({currency})
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 font-mono text-sm font-medium pointer-events-none select-none">
                            {currency}
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={extraCostoInput}
                            onChange={(e) => setExtraCostoInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddExtra();
                              }
                            }}
                            placeholder="0.00"
                            className={`w-full rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-gray-700 py-2.5 pr-3.5 ${
                              currency.length > 1 ? 'pl-10' : 'pl-8'
                            } text-sm font-mono text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 dark:focus:border-emerald-400 transition-all duration-200`}
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddExtra}
                          className="w-full py-2.5 px-3.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] shadow-sm transition-all duration-200 whitespace-nowrap"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>

                    {/* Lista compacta de extras agregados */}
                    <div className="mt-3.5 space-y-2">
                      {extrasList.length === 0 ? (
                        <div className="px-3.5 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-slate-500 text-center">
                          No hay costos extras agregados. Usa el formulario superior para añadir uno.
                        </div>
                      ) : (
                        extrasList.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200/80 dark:border-gray-700/80 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                              <span className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">
                                {extra.nombre}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                                {currency}
                                {Number(extra.costo).toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtra(extra.id)}
                                className="p-1 rounded-md text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15 transition-colors duration-200"
                                title="Eliminar extra"
                                aria-label={`Eliminar ${extra.nombre}`}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </section>

            {/* COLUMNA DERECHA: RESULTADOS, PRECIOS Y EXPORTACIÓN A PDF */}
            <aside className="lg:col-span-5 space-y-8">
              {/* Desglose de Costos */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                      {partName || 'Pieza sin nombre'}
                    </span>
                    <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                      Desglose de Costos
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 inline-block mb-1">
                      {technology}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 font-mono block">
                      {activePrinterObj ? activePrinterObj.name : 'Impresora Personalizada'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-6 bg-gray-50/80 dark:bg-slate-950/60 p-5 rounded-xl border border-gray-200/80 dark:border-gray-800">
                  <div className="sm:col-span-5 flex justify-center">
                    <CostDoughnutChart
                      items={chartItems}
                      total={calculations.totalBaseCost}
                      currency={currency}
                      isDark={darkMode}
                    />
                  </div>
                  <div className="sm:col-span-7 text-center sm:text-left">
                    <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">
                      Costo Total de Producción
                    </p>
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 my-1.5">
                      {currency}
                      {calculations.totalBaseCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                      Costo base de fabricar 1 unidad antes de margen e impuestos.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {chartItems.map((item, i) => {
                    const pct =
                      calculations.totalBaseCost > 0
                        ? Math.round((item.value / calculations.totalBaseCost) * 100)
                        : 0;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-gray-700 dark:text-slate-300">
                            {item.shortLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-xs text-gray-400 dark:text-slate-500">{pct}%</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {currency}
                            {item.value.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Estrategia de Precios + Opciones Granulares de Exportación a PDF */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-200">
                <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white mb-1">
                  Estrategia de Precios
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
                  Precios sugeridos incluyendo margen de beneficio + {taxPercent}% de IVA
                </p>

                <div className="grid grid-cols-2 gap-3.5 mb-6">
                  {[
                    { key: '25', label: 'Competitivo', badge: '+25%' },
                    { key: '40', label: 'Estándar', badge: '+40%' },
                    { key: '60', label: 'Premium', badge: '+60%' },
                    { key: '80', label: 'Lujo', badge: '+80%' },
                  ].map((tier) => {
                    const data = calculations.tiers[tier.key];
                    const active = selectedTier === tier.key;
                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setSelectedTier(tier.key)}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                          active
                            ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-500/80 dark:bg-emerald-950/20 shadow-sm ring-2 ring-emerald-500/20'
                            : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-slate-950/40 dark:hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                            {tier.label}
                          </span>
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                            {tier.badge}
                          </span>
                        </div>
                        <div className="text-xl font-extrabold font-mono tracking-tight text-gray-900 dark:text-white">
                          {currency}
                          {data.finalPrice.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                          Ganancia:{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                            +{currency}
                            {data.profit.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Personalizado */}
                  <div
                    onClick={() => setSelectedTier('custom')}
                    className={`col-span-2 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      selectedTier === 'custom'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-500/80 dark:bg-emerald-950/20 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-slate-950/40 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                          Personalizado (%)
                        </span>
                        <input
                          type="number"
                          value={customMargin}
                          onChange={(e) => {
                            setCustomMargin(parseFloat(e.target.value) || 0);
                            setSelectedTier('custom');
                          }}
                          className="w-20 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500"
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-extrabold font-mono tracking-tight text-gray-900 dark:text-white">
                          {currency}
                          {calculations.tiers.custom.finalPrice.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">
                          Ganancia:{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                            +{currency}
                            {calculations.tiers.custom.profit.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Final con jerarquía tipográfica destacada */}
                <div className="rounded-xl bg-gray-50/90 dark:bg-slate-950/70 p-5 border border-emerald-200/80 dark:border-emerald-500/30 mb-6">
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-slate-300 mb-1.5">
                    <span>Subtotal sin IVA (+{calculations.activeTier.marginPct}%):</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-white">
                      {currency}
                      {calculations.activeTier.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-slate-300 mb-3.5 pb-3.5 border-b border-gray-200/80 dark:border-gray-800">
                    <span>Impuestos / IVA ({taxPercent}%):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                      +{currency}
                      {calculations.activeTier.taxAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400 block">
                        Precio Final de Venta
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 block">
                        Ganancia neta: {currency}
                        {calculations.activeTier.profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-gray-900 dark:text-white">
                      {currency}
                      {calculations.activeTier.finalPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* CHECKLIST GRANULAR PARA OCULTAR / MOSTRAR GASTOS EN EL PDF */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-950/50 border border-gray-200/80 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold tracking-tight text-gray-800 dark:text-white">
                        Conceptos visibles en el PDF
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setAllPdfSettings(true)}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                        >
                          Todos
                        </button>
                        <span className="text-gray-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={() => setAllPdfSettings(false)}
                          className="text-gray-500 dark:text-slate-400 hover:underline font-medium"
                        >
                          Ninguno (Solo Total)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {pdfChecklistOptions.map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-center gap-2.5 text-xs font-medium text-gray-700 dark:text-slate-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={pdfSettings[opt.key]}
                            onChange={() => togglePdfSetting(opt.key)}
                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-800 leading-relaxed">
                      Los conceptos desmarcados se agrupan automáticamente bajo{' '}
                      <strong className="font-semibold text-gray-700 dark:text-slate-200">
                        "Costos Operativos, Gestión y Extras"
                      </strong>{' '}
                      para cuadrar el Subtotal exacto sin revelar tus márgenes internos.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isExportingPdf}
                    onClick={handleExportPdf}
                    className="w-full py-3.5 px-5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <span className="text-base">📄</span>
                    <span>{isExportingPdf ? 'Generando PDF...' : 'Exportar a PDF'}</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {/* PLANTILLA DEL PRESUPUESTO PDF (SIEMPRE EN FONDO BLANCO Y TEXTO OSCURO PARA IMPRESIÓN FORMAL) */}
          <section className="pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Vista Previa del Documento PDF Imprimible (Siempre Fondo Blanco Formal)
                </h3>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                {visiblePdfCostItems.length + (pdfSettings.showProfitMargin ? 1 : 0)} de 6 conceptos
                detallados
                {costosOcultosTotal > 0 ? ' • Ocultos agrupados en Costos Operativos' : ''}
              </span>
            </div>

            {/* Contenedor exacto capturado por html2canvas (ref={pdfContainerRef}) */}
            <div
              id="pdf-budget-container"
              ref={pdfContainerRef}
              style={{
                backgroundColor: '#ffffff',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                padding: '40px',
                fontFamily: 'Inter, sans-serif',
              }}
              className="max-w-4xl mx-auto shadow-lg"
            >
              {/* Encabezado Corporativo Formal */}
              <div
                style={{
                  borderBottom: '2px solid #059669',
                  paddingBottom: '20px',
                  marginBottom: '28px',
                }}
                className="flex flex-wrap items-start justify-between gap-4"
              >
                <div>
                  <span
                    style={{
                      color: '#059669',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Cotización Oficial de Fabricación Aditiva
                  </span>
                  <h2 style={{ color: '#111827', fontSize: '26px', fontWeight: 800, margin: 0 }}>
                    Presupuesto de Impresión 3D
                  </h2>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#4b5563' }}>
                  <div
                    style={{
                      color: '#0284c7',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    FOLIO: COT-3D-001
                  </div>
                  <div style={{ marginTop: '4px' }}>Fecha: {currentDateStr}</div>
                </div>
              </div>

              {/* Render Destacado Centrado Arriba de los Detalles (si el usuario subió imagen) */}
              {modelImage && (
                <div
                  style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '14px',
                    padding: '20px',
                    marginBottom: '24px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6b7280',
                      marginBottom: '12px',
                    }}
                  >
                    Vista Previa del Modelo 3D
                  </div>
                  <img
                    src={modelImage}
                    alt="Render del Modelo 3D"
                    style={{
                      maxHeight: '240px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '10px',
                      margin: '0 auto',
                      display: 'block',
                    }}
                  />
                </div>
              )}

              {/* Detalles del Proyecto */}
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6b7280',
                    marginBottom: '10px',
                  }}
                >
                  Especificaciones del Proyecto
                </div>
                <div
                  style={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      Nombre de la Pieza / Proyecto
                    </div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: '#111827',
                        marginTop: '2px',
                      }}
                    >
                      {partName || 'Pieza 3D'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Tecnología / Proceso</div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0284c7',
                        marginTop: '3px',
                      }}
                    >
                      {isFDM ? 'FDM (Filamento Termoplástico)' : 'SLA (Resina UV de Alta Precisión)'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      Tiempo de Impresión Estimado
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#111827',
                        fontFamily: 'monospace',
                        marginTop: '2px',
                      }}
                    >
                      {printHours}h {printMinutes}min ({calculations.totalPrintHours.toFixed(1)} hrs)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      Material Estimado de Fabricación
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#059669',
                        fontFamily: 'monospace',
                        marginTop: '2px',
                      }}
                    >
                      {materialUsed} {unitSuffix}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Renderizado en el PDF: Desglose de Conceptos Incluidos + Costos Operativos Agrupados */}
              <div
                style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '10px',
                    marginBottom: '16px',
                  }}
                  className="flex items-center justify-between"
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                    Desglose de Conceptos Incluidos
                  </span>
                  {pdfSettings.showMachineWear && (
                    <span
                      style={{ fontSize: '11px', fontFamily: 'monospace', color: '#d97706' }}
                    >
                      Máquina: {activePrinterObj ? activePrinterObj.name : 'Personalizada'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-4 flex flex-col items-center justify-center">
                    <CostDoughnutChart
                      items={pdfChartItems}
                      total={calculations.activeTier.subtotal}
                      currency={currency}
                      isDark={false}
                      canvasRef={pdfChartCanvasRef}
                      centerLabel="SUBTOTAL"
                    />
                    {costosOcultosTotal > 0 && (
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#64748b',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '9999px',
                            backgroundColor: '#94a3b8',
                            display: 'inline-block',
                          }}
                        />
                        <span>Gris: Costos Operativos</span>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-8 space-y-2 text-xs">
                    {/* Conceptos visibles marcados por el usuario */}
                    {visiblePdfCostItems.map((item) => (
                      <div
                        key={item.key}
                        style={{ borderBottom: '1px solid #e5e7eb', padding: '6px 0' }}
                        className="flex justify-between items-center"
                      >
                        <span
                          style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '9999px',
                              backgroundColor: item.color,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span>{item.label}</span>
                        </span>
                        <strong style={{ color: '#111827', fontFamily: 'monospace' }}>
                          {formatMoney(item.value)}
                        </strong>
                      </div>
                    ))}

                    {/* Ganancia / Margen visible SOLO si su checkbox está marcado */}
                    {pdfSettings.showProfitMargin && (
                      <div
                        style={{
                          borderBottom: costosOcultosTotal > 0 ? '1px solid #e5e7eb' : 'none',
                          padding: '6px 0',
                        }}
                        className="flex justify-between items-center"
                      >
                        <span
                          style={{
                            color: '#059669',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '9999px',
                              backgroundColor: '#10b981',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            Desglose de Ganancia / Margen (+{calculations.activeTier.marginPct}%)
                          </span>
                        </span>
                        <strong style={{ color: '#059669', fontFamily: 'monospace' }}>
                          {formatMoney(calculations.activeTier.profit)}
                        </strong>
                      </div>
                    )}

                    {/* Fila Agrupada de Costos Ocultos: aparece automáticamente cuando costosOcultosTotal > 0 */}
                    {costosOcultosTotal > 0 && (
                      <div
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                        className="flex justify-between items-center"
                      >
                        <span
                          style={{
                            color: '#334155',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '9999px',
                              backgroundColor: '#94a3b8',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span>Costos Operativos, Gestión y Extras</span>
                        </span>
                        <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                          {formatMoney(costosOcultosTotal)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen del Precio Final a Cobrar (Siempre permanece constante) */}
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #059669',
                  borderRadius: '14px',
                  padding: '22px 26px',
                }}
              >
                <div
                  style={{
                    borderBottom: '1px solid #bbf7d0',
                    paddingBottom: '8px',
                    marginBottom: '8px',
                    fontSize: '13px',
                    color: '#374151',
                  }}
                  className="flex justify-between"
                >
                  <span>Subtotal del Servicio de Impresión 3D</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                    {formatMoney(calculations.activeTier.subtotal)}
                  </span>
                </div>
                <div
                  style={{
                    borderBottom: '1px solid #bbf7d0',
                    paddingBottom: '12px',
                    marginBottom: '14px',
                    fontSize: '13px',
                    color: '#374151',
                  }}
                  className="flex justify-between"
                >
                  <span>Impuestos / IVA ({taxPercent}%)</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                    +{formatMoney(calculations.activeTier.taxAmount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span
                      style={{
                        color: '#047857',
                        fontSize: '12px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        display: 'block',
                      }}
                    >
                      Precio Total Final
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '11px' }}>
                      Importe total a pagar (Impuestos incluidos)
                    </span>
                  </div>
                  <div
                    style={{
                      color: '#059669',
                      fontSize: '32px',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                    }}
                  >
                    {formatMoney(calculations.activeTier.finalPrice)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '20px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#6b7280',
                  borderTop: '1px solid #f3f4f6',
                  paddingTop: '12px',
                }}
              >
                Presupuesto generado por 3D Print Cost Calculator • Documento formal listo para
                impresión.
              </div>
            </div>
          </section>
        </main>

        {/* Modal Gestión de Impresoras */}
        <PrinterManagerModal
          isOpen={isPrinterModalOpen}
          onClose={() => setIsPrinterModalOpen(false)}
          profiles={printerProfiles}
          currency={currency}
          onSelectProfile={handleSelectPrinterProfile}
          onAddProfile={handleAddPrinterProfile}
          onDeleteProfile={handleDeletePrinterProfile}
        />
      </div>
    </div>
  );
}
