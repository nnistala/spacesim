import { create } from 'zustand'

interface UIState {
  mapOpen: boolean
  mapZoomLevel: 'solar' | 'stellar' | 'galactic' | 'cosmic'
  infoPanelBody: string | null
  searchOpen: boolean
  timeOpen: boolean
  searchQuery: string
  searchResults: string[]
  showConstellations: boolean
  showOrbits: boolean
  showLabels: boolean
  arMode: boolean
  vrMode: boolean
  hoveredBody: string | null
  hoveredDistance: number | null
  locationBreadcrumb: string

  toggleMap: () => void
  setMapOpen: (open: boolean) => void
  setMapZoomLevel: (level: 'solar' | 'stellar' | 'galactic' | 'cosmic') => void
  setInfoPanelBody: (id: string | null) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void
  toggleTime: () => void
  setSearchQuery: (query: string) => void
  setSearchResults: (results: string[]) => void
  toggleConstellations: () => void
  toggleOrbits: () => void
  toggleLabels: () => void
  setArMode: (mode: boolean) => void
  setVrMode: (mode: boolean) => void
  setHoveredBody: (id: string | null, distance?: number | null) => void
  setLocationBreadcrumb: (breadcrumb: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  mapOpen: false,
  mapZoomLevel: 'solar',
  infoPanelBody: null,
  searchOpen: false,
  timeOpen: false,
  searchQuery: '',
  searchResults: [],
  showConstellations: false,
  showOrbits: true,
  showLabels: true,
  arMode: false,
  vrMode: false,
  hoveredBody: null,
  hoveredDistance: null,
  locationBreadcrumb: 'Solar System',

  toggleMap: () => set((s) => ({ mapOpen: !s.mapOpen })),
  setMapOpen: (open) => set({ mapOpen: open }),
  setMapZoomLevel: (level) => set({ mapZoomLevel: level }),
  setInfoPanelBody: (id) => set({ infoPanelBody: id }),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  toggleTime: () => set((s) => ({ timeOpen: !s.timeOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  toggleConstellations: () => set((s) => ({ showConstellations: !s.showConstellations })),
  toggleOrbits: () => set((s) => ({ showOrbits: !s.showOrbits })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  setArMode: (mode) => set({ arMode: mode }),
  setVrMode: (mode) => set({ vrMode: mode }),
  setHoveredBody: (id, distance = null) => set({ hoveredBody: id, hoveredDistance: distance }),
  setLocationBreadcrumb: (breadcrumb) => set({ locationBreadcrumb: breadcrumb }),
}))
