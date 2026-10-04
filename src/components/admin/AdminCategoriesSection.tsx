import React from 'react';
import { Plus, Edit2 } from 'lucide-react';

interface AdminCategoriesSectionProps {
  categories: any[];
  showCatForm: boolean;
  setShowCatForm: (val: boolean) => void;
  editingCat: any | null;
  catName: string;
  setCatName: (val: string) => void;
  catDesc: string;
  setCatDesc: (val: string) => void;
  catStatus: 'ACTIVE' | 'INACTIVE';
  setCatStatus: (val: 'ACTIVE' | 'INACTIVE') => void;
  openNewCategory: () => void;
  openEditCategory: (cat: any) => void;
  handleSaveCategory: (e: React.FormEvent) => void;
}

export const AdminCategoriesSection: React.FC<AdminCategoriesSectionProps> = ({
  categories,
  showCatForm,
  setShowCatForm,
  editingCat,
  catName,
  setCatName,
  catDesc,
  setCatDesc,
  catStatus,
  setCatStatus,
  openNewCategory,
  openEditCategory,
  handleSaveCategory,
}) => {
  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Categorias da Vitrine</h1>
          <p className="text-xs text-zinc-500">
            Organize os produtos da loja em categorias ativas ou inativas.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewCategory}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {showCatForm && (
        <form
          onSubmit={handleSaveCategory}
          className="bg-white border border-stone-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h2 className="text-sm font-bold text-zinc-900">
              {editingCat ? `Editar Categoria: ${editingCat.name}` : 'Nova Categoria'}
            </h2>
            <button
              type="button"
              onClick={() => setShowCatForm(false)}
              className="text-xs text-zinc-500 hover:text-zinc-900"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5 space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">Nome da Categoria</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex: Utilidades Domésticas"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-5 space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Breve descrição da categoria"
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-zinc-700">Status</label>
              <select
                value={catStatus}
                onChange={(e) => setCatStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
              >
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Salvar Categoria
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-200">
        {safeCategories.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          safeCategories.map((cat) => (
            <div
              key={cat.id}
              className="p-4 flex items-center justify-between gap-4 hover:bg-stone-50/60"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">{cat.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      cat.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-stone-100 text-zinc-500 border border-stone-200'
                    }`}
                  >
                    {cat.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                {cat.description && (
                  <p className="text-xs text-zinc-500 mt-0.5">{cat.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => openEditCategory(cat)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
