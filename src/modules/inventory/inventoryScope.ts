export type InventoryScope = 'all' | 'elder' | 'medical'

const elderCategories = new Set(['ration', 'fresh food', 'stationary', 'electrical', 'plumbing', 'electrical-plumbing', 'assets', 'asset'])
const medicalCategories = new Set(['medical', 'medicine', 'medicines', 'clinical', 'clinical-consumables'])

export const normalizeInventoryCategory = (category?: string | null) => String(category || '').trim().toLowerCase()

export const isCategoryInScope = (category: string | null | undefined, scope: InventoryScope | string) => {
    if (scope === 'all' || !scope) return true
    const normalized = normalizeInventoryCategory(category)
    if (scope === 'medical') return medicalCategories.has(normalized)
    return elderCategories.has(normalized) || !medicalCategories.has(normalized)
}

export const filterProductsByScope = (products: any[], scopeName?: string) => {
    if (!scopeName || scopeName === 'all') return products;
    
    return products.filter(p => isCategoryInScope(p.category, scopeName));
};
