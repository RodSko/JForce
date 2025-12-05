import React from 'react';
import { LayoutDashboard, Users, BarChart3, Boxes, FileText, Truck, ClipboardList, Map, Box } from 'lucide-react';

type View = 'daily' | 'team' | 'reports' | 'generate' | 'shipped' | 'management' | 'secondary' | 'supplies';

interface Props {
  currentView: View;
  onChangeView: (view: View) => void;
  children: React.ReactNode;
}

const Layout: React.FC<Props> = ({ currentView, onChangeView, children }) => {
  const navItems = [
    { id: 'daily', label: 'Operação Diária', icon: LayoutDashboard },
    { id: 'reports', label: 'Relatórios & Métricas', icon: BarChart3 },
    { id: 'generate', label: 'Gerar Report Carregamento', icon: FileText },
    { id: 'management', label: 'Gerar Report Gestão', icon: ClipboardList },
    { id: 'shipped', label: 'Expedido Mas Não Chegou', icon: Truck },
    { id: 'secondary', label: 'Viagens Secundárias', icon: Map },
    { id: 'supplies', label: 'Controle de Insumos', icon: Box },
    { id: 'team', label: 'Equipe', icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar / Navbar */}
      <nav className="bg-slate-900 text-slate-300 w-full md:w-64 flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">LogiTeam</h1>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onChangeView(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="p-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">v1.1.0 &bull; Logística</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10 print:hidden">
          <h2 className="text-2xl font-bold text-slate-800">
            {navItems.find(i => i.id === currentView)?.label}
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-500">
             <span className="w-2 h-2 rounded-full bg-green-500"></span>
             Sistema Operacional
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;