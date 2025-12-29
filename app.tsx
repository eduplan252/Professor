
import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, Trash2, Printer, Loader2, GraduationCap, 
  FileText, Presentation, GitGraph, Image as ImageIcon, X, ChevronLeft, Download,
  ExternalLink, Lock, ArrowRight, Upload, Users, Sparkles,
  Calendar, CalendarDays, CalendarRange, Clock, ShieldCheck, Crown, MessageCircle, Camera, RefreshCcw, LogOut, ArrowLeft,
  CheckCircle2, BrainCircuit, ScanLine, ChevronRight
} from 'lucide-react';
import { generateLessonPlan, generateLessonImage, generateStudentContent, extractTextFromImage, generateTest, correctTestWithIA } from './services/geminiService';
import { LessonPlan, LessonPlanRequest, Subject, PlanningType, GeneratedTest } from './types';

const SUBJECTS: Subject[] = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Biologia', 'Física', 'Química', 'Artes', 'Educação Física', 'Inglês', 'Outro'];

const GRADES = [
  'Educação Infantil (Creche)',
  'Educação Infantil (Pré-escola)',
  '1º Ano - Fundamental I',
  '2º Ano - Fundamental I',
  '3º Ano - Fundamental I',
  '4º Ano - Fundamental I',
  '5º Ano - Fundamental I',
  '6º Ano - Fundamental II',
  '7º Ano - Fundamental II',
  '8º Ano - Fundamental II',
  '9º Ano - Fundamental II',
  '1ª Série - Ensino Médio',
  '2ª Série - Ensino Médio',
  '3ª Série - Ensino Médio',
  'EJA - Fundamental',
  'EJA - Médio',
  'Ensino Superior',
  'Ensino Técnico / Profissionalizante'
];

const WHATSAPP_LINK = "https://wa.me/5579999055301?text=Olá!%20Gostaria%20de%20adquirir%20o%20acesso%20Premium%20do%20EduPlan%20AI.";

type UserPlan = 'free' | 'premium' | null;

const Logo = ({ size = "md", isPremium = false }: { size?: "sm" | "md" | "lg", isPremium?: boolean }) => (
  <div className="flex items-center gap-2 group">
    <div className={`relative flex items-center justify-center ${size === 'lg' ? 'h-20' : size === 'md' ? 'h-12' : 'h-8'} aspect-square rounded-2xl ${isPremium ? 'bg-amber-500' : 'bg-indigo-600'} transition-transform group-hover:rotate-3 shadow-lg`}>
      <GraduationCap className={`${size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'} text-white`} />
      {isPremium && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-white fill-white bg-amber-600 rounded-full p-0.5" />}
    </div>
    <div className="flex flex-col leading-none">
      <span className={`font-black tracking-tighter ${size === 'lg' ? 'text-4xl' : 'text-xl'} text-slate-900`}>EduPlan<span className={isPremium ? 'text-amber-500' : 'text-indigo-600'}>AI</span></span>
      <span className={`font-bold uppercase tracking-[0.2em] text-[8px] text-slate-400`}>Pedagogia Digital</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userPlan, setUserPlan] = useState<UserPlan>(null);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'map' | 'slides' | 'student' | 'test'>('plan');
  const [showHistory, setShowHistory] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ocr' | 'correct'>('ocr');
  const [isProcessingCamera, setIsProcessingCamera] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<{ score: string, feedback: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formData, setFormData] = useState<LessonPlanRequest>({ subject: 'Matemática', grade: '6º Ano - Fundamental II', topic: '', duration: '50 minutos', planningType: 'Individual' });

  useEffect(() => {
    const auth = sessionStorage.getItem('eduplan_auth');
    const type = sessionStorage.getItem('eduplan_plan') as UserPlan;
    if (auth === 'true' && type) { setIsAuthenticated(true); setUserPlan(type); }
    const saved = localStorage.getItem('eduplan_history');
    if (saved) setPlans(JSON.parse(saved));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginCode === '2026') { setIsAuthenticated(true); setUserPlan('free'); sessionStorage.setItem('eduplan_auth', 'true'); sessionStorage.setItem('eduplan_plan', 'free'); }
    else if (loginCode === '150718') { setIsAuthenticated(true); setUserPlan('premium'); sessionStorage.setItem('eduplan_auth', 'true'); sessionStorage.setItem('eduplan_plan', 'premium'); }
    else setLoginError(true);
  };

  const startCamera = (mode: 'ocr' | 'correct') => {
    setCameraMode(mode);
    setIsCameraActive(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
  };

  const handleCameraCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessingCamera(true);
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
    
    try {
      if (cameraMode === 'ocr') {
        const text = await extractTextFromImage(base64, 'image/jpeg');
        setFormData(p => ({ ...p, topic: (p.topic + " " + text).trim() }));
      } else if (cameraMode === 'correct' && currentPlan?.test) {
        const result = await correctTestWithIA(base64, currentPlan.test);
        setCorrectionResult(result);
      }
      stopCamera();
    } catch (e) { alert("Erro ao processar imagem."); }
    setIsProcessingCamera(false);
  };

  const createTest = async (type: 'objective' | 'subjective') => {
    if (!currentPlan) return;
    setIsLoading(true);
    try {
      const test = await generateTest(currentPlan, type);
      const updated = { ...currentPlan, test };
      setCurrentPlan(updated);
      const updatedHistory = plans.map(p => p.id === currentPlan.id ? updated : p);
      setPlans(updatedHistory);
      localStorage.setItem('eduplan_history', JSON.stringify(updatedHistory));
    } catch (e) { alert("Erro ao gerar prova."); }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const plan = await generateLessonPlan(formData);
      const updatedHistory = [plan, ...plans];
      setPlans(updatedHistory);
      setCurrentPlan(plan);
      setActiveTab('plan');
      localStorage.setItem('eduplan_history', JSON.stringify(updatedHistory));
    } catch (e) { alert("Erro ao gerar plano."); }
    setIsLoading(false);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <Logo size="lg" />
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 space-y-6">
          <input type="password" placeholder="Senha" value={loginCode} onChange={e => setLoginCode(e.target.value)} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white outline-none focus:border-indigo-500" />
          <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black">Entrar</button>
          <a href={WHATSAPP_LINK} className="block text-center text-amber-500 text-xs font-bold uppercase tracking-widest">Adquirir Premium</a>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className={`fixed md:relative z-30 w-72 h-screen bg-white border-r transition-transform ${showHistory ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b flex justify-between items-center"><Logo size="sm" isPremium={userPlan === 'premium'} /><button className="md:hidden" onClick={() => setShowHistory(false)}><X /></button></div>
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-140px)]">
          <button onClick={() => { setCurrentPlan(null); setActiveTab('plan'); }} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold"><PlusCircle className="w-4 h-4" /> Novo Plano</button>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Histórico</p>
            {plans.map(p => (
              <div key={p.id} onClick={() => { setCurrentPlan(p); setActiveTab('plan'); }} className={`p-3 rounded-xl cursor-pointer transition-all border ${currentPlan?.id === p.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}>
                <p className="font-bold text-sm truncate">{p.title}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{p.subject} • {p.planningType}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t absolute bottom-0 w-full"><button onClick={() => { sessionStorage.clear(); window.location.reload(); }} className="w-full flex items-center justify-center gap-2 text-slate-500 font-bold text-xs"><LogOut className="w-4 h-4" /> Sair</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="p-4 bg-white border-b flex justify-between items-center no-print">
          <button className="md:hidden p-2" onClick={() => setShowHistory(true)}><Calendar /></button>
          {currentPlan && <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
            {(['plan', 'student', 'map', 'test'] as any[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>{tab === 'test' ? 'Avaliação' : tab === 'plan' ? 'Plano' : tab === 'student' ? 'Aluno' : 'Mapa'}</button>
            ))}
          </div>}
          <div className="flex gap-2">
            {currentPlan && <button onClick={() => window.print()} className="p-2 bg-slate-50 rounded-lg"><Printer className="w-5 h-5" /></button>}
            <button onClick={() => startCamera('ocr')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Camera className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {!currentPlan ? (
            <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <Logo size="lg" isPremium={userPlan === 'premium'} />
              <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tipo de Planejamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Individual', 'Mensal', 'Semestral', 'Anual'] as PlanningType[]).map(t => (
                      <button type="button" key={t} onClick={() => setFormData({ ...formData, planningType: t })} className={`p-4 rounded-xl border-2 font-black text-xs transition-all ${formData.planningType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Disciplina</label>
                  <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value as Subject })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-700">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Série / Ano</label>
                  <select value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-700">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tema da Aula / Unidade</label>
                  <textarea placeholder="Ex: Fotossíntese, Revolução Francesa, Equações do 2º Grau..." value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl h-32 font-bold resize-none text-slate-700" required />
                </div>
                <button disabled={isLoading} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">{isLoading ? <Loader2 className="animate-spin" /> : 'GERAR PLANEJAMENTO IA'}</button>
              </form>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {activeTab === 'plan' && (
                <article className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-lg border space-y-8 animate-in fade-in duration-500">
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{currentPlan.planningType} • {currentPlan.grade}</p>
                    <h1 className="text-3xl md:text-4xl font-black uppercase text-slate-900">{currentPlan.title}</h1>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {currentPlan.bnccCodes.map(code => (
                        <span key={code} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-200">{code}</span>
                      ))}
                    </div>
                  </div>
                  <section className="space-y-4">
                    <h3 className="text-xl font-black border-l-4 border-indigo-600 pl-4 uppercase text-slate-800">Conteúdo Sequencial</h3>
                    <div className="bg-slate-50 p-6 rounded-3xl font-medium text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-100">{currentPlan.content}</div>
                  </section>
                  <section className="space-y-4">
                    <h3 className="text-xl font-black border-l-4 border-indigo-600 pl-4 uppercase text-slate-800">Objetivos de Aprendizagem</h3>
                    <ul className="space-y-3 pl-6">
                      {currentPlan.objectives.map((obj, i) => (
                        <li key={i} className="text-slate-600 font-medium list-disc">{obj}</li>
                      ))}
                    </ul>
                  </section>
                </article>
              )}

              {activeTab === 'test' && (
                <div className="space-y-8">
                  {userPlan !== 'premium' ? (
                    <div className="bg-white p-12 rounded-[2.5rem] text-center space-y-6 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-500">
                      <Crown className="w-16 h-16 text-amber-500 mx-auto" />
                      <h2 className="text-2xl font-black uppercase">Recurso Premium</h2>
                      <p className="text-slate-500 font-medium">Gere provas automáticas, gabaritos e utilize a correção via câmera.</p>
                      <a href={WHATSAPP_LINK} className="inline-block px-12 py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg hover:bg-amber-600 transition-colors">ADQUIRIR PREMIUM</a>
                    </div>
                  ) : !currentPlan.test ? (
                    <div className="bg-white p-12 rounded-[2.5rem] space-y-8 text-center shadow-xl border border-slate-100 animate-in zoom-in-95 duration-500">
                      <BrainCircuit className="w-16 h-16 text-indigo-600 mx-auto" />
                      <h2 className="text-2xl font-black uppercase">Gerador de Avaliação</h2>
                      <p className="text-slate-500 font-medium">Escolha o formato da prova baseado no conteúdo deste planejamento.</p>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={() => createTest('objective')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"><CheckCircle2 className="w-5 h-5" /> PROVA OBJETIVA</button>
                        <button onClick={() => createTest('subjective')} className="px-8 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"><FileText className="w-5 h-5" /> PROVA SUBJETIVA</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                      <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center no-print gap-6">
                        <div>
                          <h2 className="text-2xl font-black uppercase">Prova Gerada</h2>
                          <p className="opacity-80 font-bold uppercase text-[10px]">Utilize o gabarito ou a correção via câmera para agilizar seu trabalho.</p>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => startCamera('correct')} className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-xs flex items-center gap-2 shadow-xl hover:bg-slate-50"><ScanLine className="w-4 h-4" /> CORRIGIR VIA CÂMERA</button>
                           <button onClick={() => setCurrentPlan({...currentPlan, test: undefined})} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><RefreshCcw className="w-5 h-5" /></button>
                        </div>
                      </div>

                      <article className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-lg border space-y-12">
                        <div className="text-center border-b-2 border-dashed pb-8 border-slate-200">
                          <Logo size="sm" isPremium />
                          <p className="mt-4 font-black uppercase tracking-widest text-sm text-slate-800">{currentPlan.subject} • AVALIAÇÃO</p>
                          <div className="mt-8 flex flex-col md:flex-row gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span className="flex-1 border-b py-2 text-left">ALUNO: __________________________________________________</span>
                            <span className="w-full md:w-32 border-b py-2 text-center">TURMA: _______</span>
                          </div>
                        </div>

                        <div className="space-y-10">
                          {currentPlan.test.questions.map(q => (
                            <div key={q.number} className="space-y-4">
                              <p className="font-black text-lg text-slate-800 underline decoration-indigo-200 underline-offset-8">QUESTÃO {q.number}</p>
                              <p className="font-bold text-slate-700 leading-relaxed">{q.question}</p>
                              {q.options && (
                                <div className="grid grid-cols-1 gap-3 pl-4">
                                  {q.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3 font-bold text-sm text-slate-600">
                                      <span className="w-8 h-8 border-2 border-slate-200 rounded-full flex items-center justify-center text-xs shrink-0">{String.fromCharCode(65 + idx)}</span>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!q.options && (
                                <div className="mt-4 border-b-2 border-slate-100 h-24 w-full"></div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Folha de Resposta / Gabarito */}
                        <div className="mt-20 border-t-2 border-indigo-100 pt-12 no-print bg-slate-50 p-6 md:p-10 rounded-[2.5rem]">
                          <h4 className="text-center font-black uppercase tracking-widest mb-8 text-indigo-600 flex items-center justify-center gap-2"><CheckCircle2 /> Gabarito do Professor</h4>
                          <div className="flex flex-wrap gap-4 justify-center">
                            {currentPlan.test.questions.map(q => (
                              <div key={q.number} className="w-16 h-16 bg-white border-2 border-indigo-200 rounded-2xl flex flex-col items-center justify-center shadow-sm">
                                <span className="text-[10px] font-black text-slate-400">Q{q.number}</span>
                                <span className="text-xl font-black text-indigo-600">{q.correctAnswer}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Caderno de Resposta para o Aluno (Print Only) */}
                        <div className="hidden print:block mt-20 border-t-4 border-slate-900 pt-8">
                          <h4 className="text-center font-black uppercase tracking-widest mb-8">FOLHA DE RESPOSTA OFICIAL</h4>
                          <div className="grid grid-cols-5 gap-4">
                            {currentPlan.test.questions.map(q => (
                              <div key={q.number} className="border-2 border-slate-800 p-4 rounded-xl flex flex-col items-center gap-2">
                                <span className="font-black">Q{q.number}</span>
                                <div className="flex gap-1">
                                  {['A','B','C','D','E'].map(l => <span key={l} className="w-6 h-6 border-2 border-slate-300 rounded-full text-[8px] flex items-center justify-center font-bold">{l}</span>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </article>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Camera UI para Correção e OCR */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-2xl h-full md:h-auto md:aspect-video bg-slate-900 overflow-hidden md:rounded-[2.5rem] shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
               <div className="w-64 h-64 border-2 border-white/30 rounded-3xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                  <div className="absolute top-0 w-full h-0.5 bg-indigo-500 animate-[scan_2s_infinite_linear]" />
               </div>
               <p className="text-white text-[10px] font-black uppercase tracking-widest mt-6 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full">{cameraMode === 'correct' ? 'Corrigir Prova do Aluno' : 'Escanear Texto para o Tema'}</p>
            </div>
            <button onClick={stopCamera} className="absolute top-6 right-6 p-4 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-colors"><X className="w-6 h-6" /></button>
            <div className="absolute bottom-10 inset-x-0 flex justify-center">
               <button onClick={handleCameraCapture} disabled={isProcessingCamera} className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
                  {isProcessingCamera ? <Loader2 className="animate-spin text-indigo-600 w-10 h-10" /> : <div className="w-16 h-16 border-4 border-slate-100 rounded-full" />}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Resultado da Correção Modal */}
      {correctionResult && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex flex-col items-center justify-center mx-auto shadow-xl shadow-indigo-200">
               <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Nota Final</span>
               <span className="text-4xl font-black">{correctionResult.score}</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Correção Concluída</h2>
            <div className="bg-slate-50 p-6 rounded-2xl text-slate-500 font-medium text-sm leading-relaxed border italic border-slate-100">{correctionResult.feedback}</div>
            <button onClick={() => setCorrectionResult(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black tracking-widest uppercase hover:bg-slate-800 transition-colors">Fechar Resultado</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        @media print { .no-print { display: none !important; } .print\\:block { display: block !important; } }
      `}</style>
    </div>
  );
};

export default App;
