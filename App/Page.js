'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users, MapPin, Zap, Sword, LayoutDashboard, Plus, Search, Filter,
  ChevronRight, User, Info, X, Save, Globe, Sparkles, Package,
  BookOpen, Settings, Trash2, Edit3, Check, Loader2, Maximize2, GripVertical, Square, CheckSquare, AlertTriangle, ChevronDown, Link2Off
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';

// Environment variables provided by the platform
const firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "the-codex-f7a0d";

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = "Dc20hpey5";
const CLOUDINARY_UPLOAD_PRESET = "The_Codex";

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('characters');
  const [isReady, setIsReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAttributeEditor, setShowAttributeEditor] = useState(false);
  const [showLinkChecker, setShowLinkChecker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationTypeFilter, setLocationTypeFilter] = useState('All');
  const [abilityTierFilter, setAbilityTierFilter] = useState('All');
  const [itemRarityFilter, setItemRarityFilter] = useState('All');
  const [characters, setCharacters] = useState([]);
  const [locations, setLocations] = useState([]);
  const [abilities, setAbilities] = useState([]);
  const [items, setItems] = useState([]);
  const [fullViewImage, setFullViewImage] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null); 
  const [attributes, setAttributes] = useState({
    categories: ['Human', 'Beast', 'Summon', 'Zombie'],
    tiers: ['Common', 'Rare', 'Epic', 'Legendary'],
    rarities: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
    itemTypes: ['Weapon', 'Armor', 'Consumable', 'Artifact'],
    abilityTypes: ['Magic', 'Physical', 'Passive', 'Ultimate'],
    locationTypes: ['City', 'Forest', 'Dungeon', 'Empire', 'Island']
  });

  // Auth initialization
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data subscriptions
  useEffect(() => {
    if (!user) return;

    const paths = {
      characters: collection(db, 'artifacts', appId, 'public', 'data', 'characters'),
      locations: collection(db, 'artifacts', appId, 'public', 'data', 'locations'),
      abilities: collection(db, 'artifacts', appId, 'public', 'data', 'abilities'),
      items: collection(db, 'artifacts', appId, 'public', 'data', 'items'),
      config: doc(db, 'artifacts', appId, 'public', 'data', 'system', 'config')
    };

    const unsubCh = onSnapshot(paths.characters, (snap) => setCharacters(snap.docs.map(d => ({ ...d.data(), id: d.id }))), (err) => console.error(err));
    const unsubLoc = onSnapshot(paths.locations, (snap) => setLocations(snap.docs.map(d => ({ ...d.data(), id: d.id }))), (err) => console.error(err));
    const unsubAbi = onSnapshot(paths.abilities, (snap) => setAbilities(snap.docs.map(d => ({ ...d.data(), id: d.id }))), (err) => console.error(err));
    const unsubItem = onSnapshot(paths.items, (snap) => setItems(snap.docs.map(d => ({ ...d.data(), id: d.id }))), (err) => console.error(err));
    const unsubConf = onSnapshot(paths.config, (snap) => {
      if (snap.exists()) setAttributes(snap.data());
      else setDoc(paths.config, attributes);
    }, (err) => console.error(err));

    setIsReady(true);
    return () => {
      unsubCh(); unsubLoc(); unsubAbi(); unsubItem(); unsubConf();
    };
  }, [user]);
  // Reset selection when changing tabs
  useEffect(() => {
  setSelectionMode(false);
  setSelectedIds([]);
  }, [activeTab]);
  
  const navigateToEntity = (type, id) => {
  let col = type === 'locations' ? locations : type === 'characters' ? characters : type === 'abilities' ? abilities : items;
  const entity = col.find(e => e.id === id);
  if (entity) {
  setActiveTab(type);
  setSelectedEntity(entity);
  setShowLinkChecker(false);
  }
  };
  
  const handleCloudinaryUpload = async (e, onStart, onComplete) => {
  const file = e.target.files[0];
  if (!file) return;
  onStart();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  try {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  const data = await response.json();
  if (data.secure_url) onComplete(data.secure_url);
  else onComplete(null);
  } catch (err) {
  onComplete(null);
  }
  };
  
  const syncRelationships = async (sourceId, oldRels = [], newRels = []) => {
  const added = newRels.filter(nr => !oldRels.some(or => or.targetId === nr.targetId));
  const removed = oldRels.filter(or => !newRels.some(nr => nr.targetId === or.targetId));
  for (const rel of added) {
  const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'characters', rel.targetId);
  const snap = await getDoc(targetRef);
  if (snap.exists()) {
  const data = snap.data();
  const existing = data.relationships || [];
  if (!existing.some(r => r.targetId === sourceId)) {
  await updateDoc(targetRef, { relationships: [...existing, { targetId: sourceId, type: rel.type }] });
  }
  }
  }
  for (const rel of removed) {
  const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'characters', rel.targetId);
  const snap = await getDoc(targetRef);
  if (snap.exists()) {
  const data = snap.data();
  const existing = data.relationships || [];
  await updateDoc(targetRef, { relationships: existing.filter(r => r.targetId !== sourceId) });
  }
  }
  };
  
  const handleAdd = async (data) => {
  if (!user) return;
  const id = crypto.randomUUID();
  const cleanData = { ...data, id, name: data.name.trim() === '' ? 'Unnamed' : data.name, relationships: data.relationships || [], abilityIds: data.abilityIds || [] };
  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', activeTab, id), cleanData);
  if (activeTab === 'characters' && cleanData.relationships.length > 0) await syncRelationships(id, [], cleanData.relationships);
  setShowAddModal(false);
  };
  
  const handleUpdate = async (data) => {
  if (!user || !selectedEntity) return;
  const performUpdate = async () => {
  const oldRels = selectedEntity.relationships || [];
  const newRels = data.relationships || [];
  const cleanData = { ...data, name: data.name.trim() === '' ? 'Unnamed' : data.name };
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', activeTab, selectedEntity.id), cleanData);
  if (activeTab === 'characters') await syncRelationships(selectedEntity.id, oldRels, newRels);
  setSelectedEntity({ ...selectedEntity, ...cleanData });
  setIsEditing(false);
  setConfirmConfig(null);
  };
  setConfirmConfig({ title: 'Confirm Changes', message: `Are you sure you want to save changes to ${selectedEntity.name}?`, onConfirm: performUpdate, type: 'primary' });
  };
  
  const handleDelete = async () => {
  if (!user || !selectedEntity) return;
  const performDelete = async () => {
  if (activeTab === 'characters') await syncRelationships(selectedEntity.id, selectedEntity.relationships || [], []);
  await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', activeTab, selectedEntity.id));
  setSelectedEntity(null);
  setConfirmConfig(null);
  };
  setConfirmConfig({ title: 'Delete Entry', message: `Delete "${selectedEntity.name}" permanently?`, onConfirm: performDelete, type: 'danger' });
  };
  
  const handleBulkDelete = async () => {
  if (!user || selectedIds.length === 0) return;
  const performBulkDelete = async () => {
  setIsBulkDeleting(true);
  try {
  const batch = writeBatch(db);
  for (const id of selectedIds) {
  if (activeTab === 'characters') {
  const char = characters.find(c => c.id === id);
  if (char?.relationships) await syncRelationships(id, char.relationships, []);
  }
  batch.delete(doc(db, 'artifacts', appId, 'public', 'data', activeTab, id));
  }
  await batch.commit();
  setSelectedIds([]);
  setSelectionMode(false);
  setConfirmConfig(null);
  } finally {
  setIsBulkDeleting(false);
  }
  };
  setConfirmConfig({ title: 'Delete Multiple', message: `Delete ${selectedIds.length} items?`, onConfirm: performBulkDelete, type: 'danger' });
  };
  
  const toggleSelection = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const handleLongPress = (id) => { if (!selectionMode) { setSelectionMode(true); setSelectedIds([id]); } };
  
  const updateAttributes = async (key, newValue, oldVal = null) => {
  if (!user) return;
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system', 'config'), { [key]: newValue });
  if (oldVal && newValue.includes(oldVal.new) && oldVal.old) {
  const batch = writeBatch(db);
  let targetCollection = '';
  let fieldToUpdate = '';
  if (key === 'categories') { targetCollection = 'characters'; fieldToUpdate = 'category'; }
  else if (key === 'tiers') { targetCollection = 'abilities'; fieldToUpdate = 'tier'; }
  else if (key === 'rarities') { targetCollection = 'items'; fieldToUpdate = 'rarity'; }
  else if (key === 'itemTypes') { targetCollection = 'items'; fieldToUpdate = 'type'; }
  else if (key === 'abilityTypes') { targetCollection = 'abilities'; fieldToUpdate = 'type'; }
  else if (key === 'locationTypes') { targetCollection = 'locations'; fieldToUpdate = 'type'; }
  if (targetCollection) {
  const localData = targetCollection === 'characters' ? characters : targetCollection === 'abilities' ? abilities : targetCollection === 'items' ? items : locations;
  localData.forEach(entity => {
  if (entity[fieldToUpdate] === oldVal.old) {
  batch.update(doc(db, 'artifacts', appId, 'public', 'data', targetCollection, entity.id), { [fieldToUpdate]: oldVal.new });
  }
  });
  await batch.commit();
  }
  }
  };
  
  if (!isReady) return null;
  return (
  <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 text-slate-900 overflow-hidden shadow-2xl border-x border-slate-200">
  <header className="px-4 pt-6 pb-2 bg-white border-b border-slate-100 flex flex-col shrink-0">
  <div className="flex justify-between items-center h-10 mb-2">
  {!isSearchActive ? (
  <>
  <div className="flex items-center gap-3"><h1 className="text-xl font-bold tracking-tight text-slate-800 capitalize">{activeTab}</h1></div>
  <div className="flex gap-3">
  <button onClick={() => setIsSearchActive(true)} className="p-2 bg-slate-100 rounded-full active:scale-95"><Search size={20} className="text-slate-600" /></button>
  <button onClick={() => setShowAddModal(true)} className="p-2 bg-indigo-600 text-white rounded-full active:scale-95 shadow-lg shadow-indigo-200"><Plus size={20} /></button>
  </div>
  </>
  ) : (
  <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1">
  <Search size={16} className="text-slate-400" />
  <input autoFocus placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none text-sm outline-none" />
  <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} className="p-1"><X size={16} className="text-slate-400" /></button>
  </div>
  )}
  </div>
  </header>
  <main className="flex-1 overflow-y-auto pb-32 px-4 pt-4 relative">
  {activeTab === 'characters' && <CharacterScreen characters={characters} onSelect={setSelectedEntity} onToggleSelection={toggleSelection} onLongPress={handleLongPress} categories={attributes.categories} searchQuery={searchQuery} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} selectionMode={selectionMode} selectedIds={selectedIds} />}
  {activeTab === 'locations' && <LocationScreen locations={locations} onSelect={setSelectedEntity} onToggleSelection={toggleSelection} onLongPress={handleLongPress} searchQuery={searchQuery} typeFilter={locationTypeFilter} setTypeFilter={setLocationTypeFilter} selectionMode={selectionMode} selectedIds={selectedIds} locationTypes={attributes.locationTypes || []} />}
  {activeTab === 'abilities' && <AbilityScreen abilities={abilities} onSelect={setSelectedEntity} onToggleSelection={toggleSelection} onLongPress={handleLongPress} searchQuery={searchQuery} tiers={attributes.tiers} tierFilter={abilityTierFilter} setTierFilter={setAbilityTierFilter} selectionMode={selectionMode} selectedIds={selectedIds} />}
  {activeTab === 'items' && <ItemScreen items={items} onSelect={setSelectedEntity} onToggleSelection={toggleSelection} onLongPress={handleLongPress} searchQuery={searchQuery} rarities={attributes.rarities} rarityFilter={itemRarityFilter} setRarityFilter={setItemRarityFilter} selectionMode={selectionMode} selectedIds={selectedIds} />}
  {activeTab === 'dashboard' && <DashboardScreen characters={characters} locations={locations} abilities={abilities} items={items} onTabSelect={setActiveTab} onOpenSettings={() => setShowAttributeEditor(true)} onOpenLinkChecker={() => setShowLinkChecker(true)} />}
  
  {selectionMode && (
  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[calc(448px-2rem)] bg-slate-900 text-white py-3 px-6 rounded-2xl flex justify-between items-center shadow-2xl animate-in slide-in-from-bottom-4 z-[40]">
  <div className="flex items-center gap-3">
  <button onClick={() => { setSelectionMode(false); setSelectedIds([]); }} className="p-1.5 bg-slate-800 rounded-lg"><X size={16} /></button>
  <span className="text-xs font-bold">{selectedIds.length} Selected</span>
  </div>
  {selectedIds.length > 0 && <button disabled={isBulkDeleting} onClick={handleBulkDelete} className="bg-rose-500 p-2 rounded-xl disabled:opacity-50">{isBulkDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}</button>}
  </div>
  )}
  </main>
  
  {confirmConfig && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md px-6">
  <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-in zoom-in">
  <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center ${confirmConfig.type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`}><AlertTriangle size={24} /></div>
  <h2 className="text-lg font-bold mb-2">{confirmConfig.title}</h2>
  <p className="text-sm text-slate-500 mb-6">{confirmConfig.message}</p>
  <div className="flex gap-3">
  <button onClick={() => setConfirmConfig(null)} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-bold text-sm">Cancel</button>
  <button onClick={confirmConfig.onConfirm} className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm shadow-lg ${confirmConfig.type === 'danger' ? 'bg-rose-500 shadow-rose-100' : 'bg-indigo-600 shadow-indigo-100'}`}>Confirm</button>
  </div>
  </div>
  </div>
  )}
  
  {showAddModal && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
  <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl overflow-hidden flex flex-col">
  <div className="flex justify-between items-center mb-6 shrink-0"><h2 className="text-xl font-bold">New {activeTab.slice(0, -1)}</h2><button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button></div>
  <div className="overflow-y-auto flex-1"><EntityForm tab={activeTab} onSave={handleAdd} onCancel={() => setShowAddModal(false)} locations={locations} allCharacters={characters} allAbilities={abilities} attributes={attributes} handleUpload={handleCloudinaryUpload} /></div>
  </div>
  </div>
  )}
  {selectedEntity && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
  <div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
  <div className="flex justify-between items-center mb-6 shrink-0">
  <div className="flex gap-2">
  <button onClick={handleDelete} className="p-2 bg-rose-50 text-rose-500 rounded-full"><Trash2 size={20} /></button>
  <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{isEditing ? <Check size={20} /> : <Edit3 size={20} />}</button>
  </div>
  <button onClick={() => { setSelectedEntity(null); setIsEditing(false); }} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
  </div>
  <div className="overflow-y-auto flex-1 pb-8">{isEditing ? <EntityForm tab={activeTab} initialData={selectedEntity} onSave={handleUpdate} onCancel={() => setIsEditing(false)} locations={locations} allCharacters={characters} allAbilities={abilities} attributes={attributes} handleUpload={handleCloudinaryUpload} /> : <DetailContent entity={selectedEntity} activeTab={activeTab} locations={locations} allCharacters={characters} allAbilities={abilities} onNavigate={navigateToEntity} onImageClick={setFullViewImage} />}</div>
  </div>
  </div>
  )}
  
  {fullViewImage && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" onClick={() => setFullViewImage(null)}><button className="absolute top-6 right-6 p-3 text-white/50"><X size={32} /></button><img src={fullViewImage} alt="" className="max-w-full max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} /></div>}
  {showAttributeEditor && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm"><div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"><div className="flex justify-between items-center mb-6 shrink-0"><h2 className="text-xl font-bold">Attributes</h2><button onClick={() => setShowAttributeEditor(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button></div><div className="overflow-y-auto flex-1 pb-8"><AttributeManager attributes={attributes} onUpdate={updateAttributes} /></div></div></div>}
  {showLinkChecker && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm"><div className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"><div className="flex justify-between items-center mb-6 shrink-0"><h2 className="text-xl font-bold">Broken Link Checker</h2><button onClick={() => setShowLinkChecker(false)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button></div><div className="overflow-y-auto flex-1 pb-8 px-1"><BrokenLinkChecker characters={characters} locations={locations} abilities={abilities} items={items} onNavigate={navigateToEntity} /></div></div></div>}
  
  <nav className="fixed bottom-0 w-full max-w-md bg-white/80 backdrop-blur-lg border-t border-slate-200 px-2 pb-6 pt-2 shrink-0">
  <div className="flex justify-around items-center">
  <NavButton active={activeTab === 'characters'} onClick={() => { setActiveTab('characters'); setCategoryFilter('All'); }} icon={<Users size={22} />} label="Ch" />
  <NavButton active={activeTab === 'locations'} onClick={() => { setActiveTab('locations'); setLocationTypeFilter('All'); }} icon={<MapPin size={22} />} label="Loc" />
  <NavButton active={activeTab === 'abilities'} onClick={() => { setActiveTab('abilities'); setAbilityTierFilter('All'); }} icon={<Zap size={22} />} label="Abi" />
  <NavButton active={activeTab === 'items'} onClick={() => { setActiveTab('items'); setItemRarityFilter('All'); }} icon={<Sword size={22} />} label="Item" />
  <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setCategoryFilter('All'); }} icon={<LayoutDashboard size={22} />} label="Dash" />
  </div>
  </nav>
  </div>
  );
  };
  const BrokenLinkChecker = ({ characters, locations, abilities, items, onNavigate }) => {
  const issues = useMemo(() => {
  const list = [];
  const locationIds = new Set(locations.map(l => l.id));
  const characterIds = new Set(characters.map(c => c.id));
  const abilityIds = new Set(abilities.map(a => a.id));
  characters.forEach(char => {
  if (char.residenceId && !locationIds.has(char.residenceId)) list.push({ source: char, type: 'characters', field: 'Residence', label: 'Missing Location', id: char.residenceId });
  const rels = Array.isArray(char.relationships) ? char.relationships : [];
  rels.forEach(rel => { if (rel.targetId && !characterIds.has(rel.targetId)) list.push({ source: char, type: 'characters', field: `Relationship (${rel.type || 'Unnamed'})`, label: 'Missing Character', id: rel.targetId }); });
  const abils = Array.isArray(char.abilityIds) ? char.abilityIds : [];
  abils.forEach(aid => { if (aid && !abilityIds.has(aid)) list.push({ source: char, type: 'characters', field: 'Ability', label: 'Missing Ability', id: aid }); });
  });
  locations.forEach(loc => { if (loc.parentId && !locationIds.has(loc.parentId)) list.push({ source: loc, type: 'locations', field: 'Parent Location', label: 'Missing Parent', id: loc.parentId }); });
  return list;
  }, [characters, locations, abilities]);
  if (issues.length === 0) return <div className="flex flex-col items-center justify-center py-12 text-slate-400"><div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4"><Check size={32} /></div><p className="text-sm">All links healthy!</p></div>;
  return (
  <div className="space-y-3">
  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 mb-4"><AlertTriangle size={18} className="text-amber-600 shrink-0" /><div><h4 className="text-sm font-bold text-amber-900">Found {issues.length} orphaned links</h4><p className="text-xs text-amber-700 mt-1">Links to deleted entries detected.</p></div></div>
  {issues.map((issue, idx) => (
  <button key={idx} onClick={() => onNavigate(issue.type, issue.source.id)} className="w-full text-left bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between hover:bg-slate-50 transition-all">
  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500"><Link2Off size={20} /></div><div><h5 className="text-sm font-bold text-slate-800">{issue.source.name}</h5><p className="text-[11px] text-slate-400 font-medium">{issue.field}</p></div></div>
  <span className="text-[10px] font-black uppercase bg-rose-50 text-rose-600 px-2 py-1 rounded-md">{issue.label}</span>
  </button>
  ))}
  </div>
  );
  };
  const EntityForm = ({ tab, initialData, onSave, onCancel, locations, allCharacters, allAbilities, attributes, handleUpload }) => {
  const [formData, setFormData] = useState(() => {
  if (initialData) return initialData;
  const defaults = { name: '', images: [], relationships: [], abilityIds: [] };
  if (tab === 'characters') defaults.category = attributes.categories[0];
  if (tab === 'abilities') { defaults.type = attributes.abilityTypes[0]; defaults.tier = attributes.tiers[0]; }
  if (tab === 'items') { defaults.type = attributes.itemTypes[0]; defaults.rarity = attributes.rarities[0]; }
  if (tab === 'locations') { defaults.type = attributes.locationTypes[0]; }
  return defaults;
  });
  const [isUploading, setIsUploading] = useState(false);
  const onFileChange = (e) => handleUpload(e, () => setIsUploading(true), (url) => { setIsUploading(false); if (url) setFormData(prev => ({ ...prev, images: [...(prev.images || []), url] })); });
  const renderFields = () => {
  switch (tab) {
  case 'characters':
  return (
  <>
  <div className="grid grid-cols-2 gap-3">
  <input placeholder="Name" value={formData.name || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} />
  <select value={formData.category || attributes.categories[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, category: e.target.value })}>{attributes.categories.map(c => <option key={c}>{c}</option>)}</select>
  </div>
  {formData.category === 'Human' && (
  <div className="space-y-3">
  <div className="grid grid-cols-2 gap-3"><input placeholder="Title" value={formData.title || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, title: e.target.value })} /><input placeholder="Age" value={formData.age || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, age: e.target.value })} /></div>
  <div className="bg-slate-50 rounded-xl p-3"><span className="block text-[10px] font-black uppercase text-slate-400 mb-2">Abilities</span><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">{allAbilities.map(abi => (<button key={abi.id} type="button" onClick={() => { const current = formData.abilityIds || []; setFormData({ ...formData, abilityIds: current.includes(abi.id) ? current.filter(i => i !== abi.id) : [...current, abi.id] }); }} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${(formData.abilityIds || []).includes(abi.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>{abi.name}</button>))}</div></div>
  </div>
  )}
  <select value={formData.residenceId || ''} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none text-slate-500" onChange={e => setFormData({ ...formData, residenceId: e.target.value })}><option value="">Residence (Location)</option>{locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select>
  <div className="space-y-3">
  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relationships</span><button type="button" onClick={() => setFormData({ ...formData, relationships: [...(formData.relationships || []), { targetId: '', type: '' }] })} className="p-1.5 bg-slate-100 rounded-lg"><Plus size={16} /></button></div>
  {(formData.relationships || []).map((rel, idx) => (
  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
  <select value={rel.targetId} onChange={e => { const r = [...formData.relationships]; r[idx].targetId = e.target.value; setFormData({ ...formData, relationships: r }); }} className="flex-1 bg-white rounded-lg p-2 text-xs outline-none"><option value="">Select Character</option>{allCharacters.filter(c => c.id !== (formData.id || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  <input placeholder="Type" value={rel.type} onChange={e => { const r = [...formData.relationships]; r[idx].type = e.target.value; setFormData({ ...formData, relationships: r }); }} className="flex-1 bg-white rounded-lg p-2 text-xs outline-none" />
  <button type="button" onClick={() => setFormData({ ...formData, relationships: formData.relationships.filter((_, i) => i !== idx) })} className="p-1.5 text-rose-400"><X size={16} /></button>
  </div>
  ))}
  </div>
  </>
  );
  case 'locations':
  return (
  <div className="space-y-3">
  <div className="grid grid-cols-2 gap-3"><input placeholder="Name" value={formData.name || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} /><select value={formData.type || attributes.locationTypes[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, type: e.target.value })}>{attributes.locationTypes.map(t => <option key={t}>{t}</option>)}</select></div>
  <select value={formData.parentId || ''} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none text-slate-500" onChange={e => setFormData({ ...formData, parentId: e.target.value })}><option value="">Parent Location</option>{locations.filter(l => l.id !== formData.id).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select>
  </div>
  );
  case 'abilities':
  return (
  <div className="space-y-3">
  <div className="grid grid-cols-2 gap-3"><input placeholder="Name" value={formData.name || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} /><input placeholder="Notable Users" value={formData.notableUsers || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, notableUsers: e.target.value })} /></div>
  <div className="grid grid-cols-2 gap-3"><select value={formData.type || attributes.abilityTypes[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, type: e.target.value })}>{attributes.abilityTypes.map(t => <option key={t}>{t}</option>)}</select><select value={formData.tier || attributes.tiers[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, tier: e.target.value })}>{attributes.tiers.map(t => <option key={t}>{t}</option>)}</select></div>
  </div>
  );
  case 'items':
  return (
  <div className="space-y-3">
  <div className="grid grid-cols-2 gap-3"><input placeholder="Name" value={formData.name || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, name: e.target.value })} /><input placeholder="Weight" value={formData.weight || ''} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, weight: e.target.value })} /></div>
  <div className="grid grid-cols-2 gap-3"><select value={formData.type || attributes.itemTypes[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, type: e.target.value })}>{attributes.itemTypes.map(t => <option key={t}>{t}</option>)}</select><select value={formData.rarity || attributes.rarities[0]} className="bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, rarity: e.target.value })}>{attributes.rarities.map(r => <option key={r}>{r}</option>)}</select></div>
  </div>
  );
  default: return null;
  }
  };
  return (
  <div className="space-y-4 max-h-[70vh] overflow-y-auto pb-6">
  <ImageUploadStrip images={formData.images || []} isUploading={isUploading} onAdd={onFileChange} onRemove={idx => setFormData({ ...formData, images: (formData.images || []).filter((_, i) => i !== idx) })} />
  {renderFields()}
  <textarea placeholder="Description" value={formData.lore || ''} rows="4" className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" onChange={e => setFormData({ ...formData, lore: e.target.value })} />
  <div className="flex gap-3 pt-2">
  <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">Cancel</button>
  <button disabled={isUploading} onClick={() => onSave(formData)} className={`flex-1 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 ${isUploading ? 'bg-slate-400' : 'bg-indigo-600'}`}>{isUploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isUploading ? 'Uploading...' : (initialData ? 'Update' : 'Add')}</button>
  </div>
  </div>
  );
  };
  const ImageUploadStrip = ({ images, isUploading, onAdd, onRemove }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
  <label className={`shrink-0 w-20 h-20 bg-slate-100 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>{isUploading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}{!isUploading && <input type="file" accept="image/*" className="hidden" onChange={onAdd} />}</label>
  {images.map((img, i) => (
  <div key={i} className="relative shrink-0 w-20 h-20"><img src={img} alt="" className="w-full h-full object-cover rounded-xl border border-slate-100" /><button onClick={() => onRemove(i)} className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 shadow-sm"><X size={12} /></button></div>
  ))}
  </div>
  );
  
  const DetailContent = ({ entity, activeTab, locations, allCharacters, allAbilities, onNavigate, onImageClick }) => {
  const [imgIdx, setImgIdx] = useState(0);
  const images = entity.images || [];
  const resLoc = entity.residenceId ? locations.find(l => l.id === entity.residenceId) : null;
  const parLoc = entity.parentId ? locations.find(l => l.id === entity.parentId) : null;
  const assignedAbilities = (entity.abilityIds || []).map(id => allAbilities.find(a => a.id === id)).filter(Boolean);
  const subLocations = activeTab === 'locations' ? locations.filter(l => l.parentId === entity.id) : [];
  return (
  <div className="space-y-6">
  <div className="bg-slate-50 rounded-2xl p-4 text-center">
  {images.length > 0 ? (
  <div className="relative w-full aspect-square bg-white rounded-2xl mb-4 overflow-hidden group">
  <img src={images[imgIdx]} alt="" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => onImageClick(images[imgIdx])} />
  {images.length > 1 && <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">{images.map((_, i) => (<button key={i} onClick={() => setImgIdx(i)} className={`w-1.5 h-1.5 rounded-full ${imgIdx === i ? 'bg-indigo-600 w-4' : 'bg-slate-300'}`} />))}</div>}
  </div>
  ) : <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">{activeTab === 'characters' ? <User size={40} /> : activeTab === 'locations' ? <Globe size={40} /> : <Zap size={40} />}</div>}
  <h3 className="text-2xl font-bold text-slate-900">{entity.name}</h3><p className="text-slate-500 font-medium">{entity.category || entity.type}</p>
  </div>
  <div className="grid grid-cols-2 gap-3">{entity.category && <InfoBit label="Category" value={entity.category} />}{entity.type && <InfoBit label="Type" value={entity.type} />}{entity.age && <InfoBit label="Age" value={entity.age} />}{resLoc && <InfoBit label="Residence" value={resLoc.name} onClick={() => onNavigate('locations', resLoc.id)} />}{parLoc && <InfoBit label="In" value={parLoc.name} onClick={() => onNavigate('locations', parLoc.id)} />}</div>
  {subLocations.length > 0 && (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
  <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Sub-Locations</h4>
  <div className="space-y-2">{subLocations.map(loc => (<button key={loc.id} onClick={() => onNavigate('locations', loc.id)} className="w-full flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-bold">{loc.name}</span><span className="text-[11px] font-bold text-emerald-500">{loc.type}</span></button>))}</div>
  </div>
  )}
  {assignedAbilities.length > 0 && <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Abilities</h4><div className="flex flex-wrap gap-2">{assignedAbilities.map(abi => (<button key={abi.id} onClick={() => onNavigate('abilities', abi.id)} className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">{abi.name}</button>))}</div></div>}
  {entity.relationships?.length > 0 && (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
  <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Relationships</h4>
  <div className="space-y-2">
  {entity.relationships.map((rel, i) => {
  const t = allCharacters.find(c => c.id === rel.targetId);
  if (!t) return null;
  return (<button key={i} onClick={() => onNavigate('characters', rel.targetId)} className="w-full flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100"><span className="text-sm font-bold">{t.name}</span><span className="text-[11px] font-bold text-indigo-500">{rel.type}</span></button>);
  })}
  </div>
  </div>
  )}
  {entity.lore && <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"><h4 className="text-xs font-black uppercase text-slate-400 mb-2">Lore</h4><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{entity.lore}</p></div>}
  </div>
  );
  };
  const InfoBit = ({ label, value, onClick }) => (
  <button onClick={onClick} disabled={!onClick} className={`w-full text-left bg-slate-50 rounded-xl p-3 border border-slate-100/50 ${onClick ? 'active:scale-95 text-indigo-600 border-indigo-100' : 'text-slate-800'}`}>
  <span className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">{label}</span>
  <span className="block text-sm font-bold truncate capitalize">{value}</span>
  </button>
  );
  
  const CharacterScreen = ({ characters, onSelect, onToggleSelection, onLongPress, categories, searchQuery, categoryFilter, setCategoryFilter, selectionMode, selectedIds }) => {
  const filtered = characters.filter(char => (categoryFilter === 'All' || char.category === categoryFilter) && char.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
  <div className="space-y-4">
  <div className="relative"><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 appearance-none text-sm font-medium outline-none"><option value="All">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><Filter size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" /></div>
  {filtered.length === 0 ? <EmptyState icon={<Users size={48} />} text="No characters." /> : <div className="grid grid-cols-2 gap-3 pb-8">{filtered.map(char => (<EntityCard key={char.id} entity={char} icon={<User size={32} />} subtitle={char.category} selectionMode={selectionMode} isSelected={selectedIds.includes(char.id)} onClick={() => selectionMode ? onToggleSelection(char.id) : onSelect(char)} onLongPress={() => onLongPress(char.id)} />))}</div>}
  </div>
  );
  };
  const EntityCard = ({ entity, icon, subtitle, subtitleRight, selectionMode, isSelected, onClick, onLongPress, themeColor = 'bg-slate-100', iconColor = 'text-slate-400' }) => {
  const timerRef = useRef(null);
  const isLongPress = useRef(false);
  const handleTouchStart = () => { isLongPress.current = false; timerRef.current = setTimeout(() => { isLongPress.current = true; onLongPress(); }, 600); };
  const handleTouchEnd = (e) => { clearTimeout(timerRef.current); if (isLongPress.current) e.preventDefault(); };
  return (
  <div onClick={() => !isLongPress.current && onClick()} onMouseDown={() => { isLongPress.current = false; timerRef.current = setTimeout(() => { isLongPress.current = true; onLongPress(); }, 600); }} onMouseUp={() => clearTimeout(timerRef.current)} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={`relative bg-white rounded-2xl p-2 border shadow-sm active:bg-slate-50 transition-all select-none ${selectionMode && isSelected ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500' : 'border-slate-100'}`}>
  {selectionMode && <div className="absolute top-3 right-3 z-10 p-1 rounded-full bg-white shadow-md border border-slate-100 text-indigo-600">{isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}</div>}
  <div className={`aspect-[4/3] ${themeColor} rounded-xl mb-2 overflow-hidden flex items-center justify-center ${iconColor}`}>{entity.images?.[0] ? <img src={entity.images[0]} alt="" className="w-full h-full object-cover" /> : icon}</div>
  <div className="px-1 pb-1">
  <h3 className="font-bold text-sm text-slate-800 leading-tight truncate">{entity.name}</h3>
  <div className="flex justify-between items-center mt-0.5"><p className="text-[11px] text-slate-500 truncate capitalize">{subtitle}</p>{subtitleRight && <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${subtitleRight.style}`}>{subtitleRight.label}</span>}</div>
  </div>
  </div>
  );
  };
  // Surgical Improvement: Unified Location Selection Logic within Tree View
  const LocationNode = ({ location, allLocations, depth = 0, onSelect, onToggleSelection, onLongPress, selectionMode, selectedIds, searchActive }) => {
  const children = allLocations.filter(l => l.parentId === location.id);
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedIds.includes(location.id);
  
  // Unified touch/selection handling for tree nodes
  const timerRef = useRef(null);
  const isLongPressActive = useRef(false);
  
  const handleStart = () => {
  isLongPressActive.current = false;
  timerRef.current = setTimeout(() => {
  isLongPressActive.current = true;
  onLongPress(location.id);
  }, 600);
  };
  
  const handleEnd = (e) => {
  clearTimeout(timerRef.current);
  };
  
  const handleClick = (e) => {
  if (isLongPressActive.current) return;
  if (selectionMode) {
  onToggleSelection(location.id);
  } else {
  onSelect(location);
  }
  };
  
  return (
  <div className="w-full">
  <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-2 py-1">
  <div className="flex-1">
  <div 
  onClick={handleClick}
  onMouseDown={handleStart}
  onMouseUp={handleEnd}
  onTouchStart={handleStart}
  onTouchEnd={handleEnd}
  className={`flex items-center gap-3 p-3 bg-white border rounded-2xl transition-all active:scale-[0.98] cursor-pointer select-none ${selectionMode && isSelected ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500' : 'border-slate-100 shadow-sm'}`}
  >
  {children.length > 0 && !searchActive && (
  <button 
  onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
  className={`p-1 hover:bg-slate-100 rounded-lg transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
  >
  <ChevronDown size={16} className="text-slate-400" />
  </button>
  )}
  
  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200/50">
  {location.images?.[0] ? <img src={location.images[0]} alt="" className="w-full h-full object-cover" /> : <MapPin size={18} className="text-slate-400" />}
  </div>
  
  <div className="flex-1 min-w-0">
  <h4 className="font-bold text-sm text-slate-800 truncate">{location.name}</h4>
  <p className="text-[11px] text-slate-400 uppercase font-bold tracking-tight">{location.type}</p>
  </div>
  
  {selectionMode && (
  <div className="p-1 rounded-full bg-white shadow-sm border border-slate-100 text-indigo-600">
  {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
  </div>
  )}
  </div>
  </div>
  </div>
{isExpanded && !searchActive && children.length > 0 && (
  <div className="mt-1">
  {children.map(child => (
  <LocationNode 
  key={child.id}
  location={child}
  allLocations={allLocations}
  depth={depth + 1}
  onSelect={onSelect}
  onToggleSelection={onToggleSelection}
  onLongPress={onLongPress}
  selectionMode={selectionMode}
  selectedIds={selectedIds}
  searchActive={searchActive}
  />
  ))}
  </div>
  )}
  </div>
  );
  };
  const LocationScreen = ({ locations, onSelect, onToggleSelection, onLongPress, searchQuery, typeFilter, setTypeFilter, selectionMode, selectedIds, locationTypes }) => {
  const isSearchActive = searchQuery.trim() !== '' || typeFilter !== 'All';
  const filtered = locations.filter(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase()) && (typeFilter === 'All' || loc.type === typeFilter));
  const rootLocations = locations.filter(l => !l.parentId || !locations.find(pl => pl.id === l.parentId));
  return (
  <div className="space-y-4">
  <div className="relative"><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 appearance-none text-sm font-medium outline-none"><option value="All">All Types</option>{locationTypes.map(t => <option key={t} value={t}>{t}</option>)}</select><Filter size={14} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" /></div>
  {isSearchActive ? (
  filtered.length === 0 ? <EmptyState icon={<MapPin size={48} />} text="No locations." /> : <div className="space-y-3 pb-8">{filtered.map(loc => (<div key={loc.id} onClick={() => selectionMode ? onToggleSelection(loc.id) : onSelect(loc)} className={`flex items-center gap-3 p-3 bg-white border rounded-2xl transition-all ${selectionMode && selectedIds.includes(loc.id) ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500' : 'border-slate-100 shadow-sm'}`}><div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">{loc.images?.[0] ? <img src={loc.images[0]} alt="" className="w-full h-full object-cover" /> : <MapPin size={18} className="text-slate-400" />}</div><div className="flex-1 min-w-0"><h4 className="font-bold text-sm text-slate-800 truncate">{loc.name}</h4><p className="text-[11px] text-slate-400 uppercase font-bold tracking-tight">{loc.type}</p></div>{selectionMode && <div className="p-1 rounded-full bg-white shadow-sm border border-slate-100 text-indigo-600">{selectedIds.includes(loc.id) ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}</div>}</div>))}</div>
  ) : (
  rootLocations.length === 0 ? <EmptyState icon={<MapPin size={48} />} text="No locations." /> : <div className="space-y-2 pb-8">{rootLocations.map(loc => (<LocationNode key={loc.id} location={loc} allLocations={locations} onSelect={onSelect} onToggleSelection={onToggleSelection} onLongPress={onLongPress} selectionMode={selectionMode} selectedIds={selectedIds} searchActive={false} />))}</div>
  )}
  </div>
  );
  };
  const AbilityScreen = ({ abilities, onSelect, onToggleSelection, onLongPress, searchQuery, tiers, tierFilter, setTierFilter, selectionMode, selectedIds }) => {
  const filtered = abilities.filter(abi => (tierFilter === 'All' || abi.tier === tierFilter) && abi.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
  <div className="space-y-4">
  <div className="relative"><select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 appearance-none text-sm font-medium outline-none"><option value="All">All Tiers</option>{tiers.map(t => <option key={t} value={t}>{t}</option>)}</select><Filter size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" /></div>
  {filtered.length === 0 ? <EmptyState icon={<Zap size={48} />} text="No abilities." /> : <div className="grid grid-cols-2 gap-3 pb-8">{filtered.map(abi => (<EntityCard key={abi.id} entity={abi} icon={<Zap size={32} />} subtitle={abi.type} subtitleRight={{ label: abi.tier, style: 'bg-amber-100/50 text-amber-600' }} themeColor="bg-amber-50" iconColor="text-amber-600" selectionMode={selectionMode} isSelected={selectedIds.includes(abi.id)} onClick={() => selectionMode ? onToggleSelection(abi.id) : onSelect(abi)} onLongPress={() => onLongPress(abi.id)} />))}</div>}
  </div>
  );
  };
  
  const ItemScreen = ({ items, onSelect, onToggleSelection, onLongPress, searchQuery, rarities, rarityFilter, setRarityFilter, selectionMode, selectedIds }) => {
  const filtered = items.filter(item => (rarityFilter === 'All' || item.rarity === rarityFilter) && item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
  <div className="space-y-4">
  <div className="relative"><select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 appearance-none text-sm font-medium outline-none"><option value="All">All Rarities</option>{rarities.map(r => <option key={r} value={r}>{r}</option>)}</select><Filter size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" /></div>
  {filtered.length === 0 ? <EmptyState icon={<Sword size={48} />} text="No items." /> : <div className="grid grid-cols-2 gap-3 pb-8">{filtered.map(item => (<EntityCard key={item.id} entity={item} icon={<Package size={32} />} subtitle={item.type} subtitleRight={{ label: item.rarity, style: 'bg-purple-100/50 text-purple-600' }} themeColor="bg-purple-50" iconColor="text-purple-600" selectionMode={selectionMode} isSelected={selectedIds.includes(item.id)} onClick={() => selectionMode ? onToggleSelection(item.id) : onSelect(item)} onLongPress={() => onLongPress(item.id)} />))}</div>}
  </div>
  );
  };
  
  const AttributeManager = ({ attributes, onUpdate }) => {
  const [activeSet, setActiveSet] = useState('categories');
  const [newVal, setNewVal] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState('');
  const handleAdd = () => { if (!newVal.trim()) return; onUpdate(activeSet, [...(attributes[activeSet] || []), newVal.trim()]); setNewVal(''); };
  const handleRemove = (index) => { onUpdate(activeSet, attributes[activeSet].filter((_, i) => i !== index)); };
  const handleSaveEdit = () => {
  if (!editVal.trim() || editVal === attributes[activeSet][editingIdx]) { setEditingIdx(null); return; }
  const newList = [...attributes[activeSet]];
  const oldVal = attributes[activeSet][editingIdx];
  newList[editingIdx] = editVal.trim();
  onUpdate(activeSet, newList, { old: oldVal, new: editVal.trim() });
  setEditingIdx(null);
  };
  return (
  <div className="space-y-6">
  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{Object.keys(attributes).map(key => (<button key={key} onClick={() => {setActiveSet(key); setEditingIdx(null);}} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${activeSet === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{key.toUpperCase()}</button>))}</div>
  <div className="flex gap-2"><input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Add new..." className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-sm outline-none" /><button onClick={handleAdd} className="p-3 bg-indigo-600 text-white rounded-xl"><Plus size={20} /></button></div>
  <div className="space-y-2">{(attributes[activeSet] || []).map((item, idx) => (<div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl"><div className="flex items-center gap-3 flex-1">{editingIdx === idx ? <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={handleSaveEdit} className="bg-slate-50 rounded px-2 py-1 text-sm outline-none w-full" /> : <span className="text-sm font-medium text-slate-700">{item}</span>}</div><div className="flex gap-2">{editingIdx === idx ? <button onClick={handleSaveEdit} className="text-emerald-500"><Check size={16} /></button> : <><button onClick={() => { setEditingIdx(idx); setEditVal(item); }} className="text-slate-300"><Edit3 size={16} /></button><button onClick={() => handleRemove(idx)} className="text-slate-300"><Trash2 size={16} /></button></>}</div></div>))}</div>
  </div>
  );
  };
  const DashboardScreen = ({ characters, locations, abilities, items, onTabSelect, onOpenSettings, onOpenLinkChecker }) => (
  <div className="space-y-6">
  <div className="grid grid-cols-2 gap-4"><StatCard label="Characters" value={characters.length} color="bg-blue-50 text-blue-600" onClick={() => onTabSelect('characters')} /><StatCard label="Locations" value={locations.length} color="bg-emerald-50 text-emerald-600" onClick={() => onTabSelect('locations')} /><StatCard label="Abilities" value={abilities.length} color="bg-amber-50 text-amber-600" onClick={() => onTabSelect('abilities')} /><StatCard label="Items" value={items.length} color="bg-purple-50 text-purple-600" onClick={() => onTabSelect('items')} /></div>
  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
  <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2 text-sm"><Settings size={16} className="text-indigo-500" />Management</h3>
  <button onClick={onOpenSettings} className="w-full text-left px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium flex justify-between items-center">Manage Attributes<ChevronRight size={16} className="text-slate-400" /></button>
  <button onClick={onOpenLinkChecker} className="w-full text-left px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium flex justify-between items-center">Broken Link Checker<ChevronRight size={16} className="text-slate-400" /></button>
  </div>
  </div>
  );
  
  const NavButton = ({ active, onClick, icon, label }) => (<button onClick={onClick} className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}><div>{icon}</div><span className="text-[10px] font-bold mt-1 uppercase tracking-wider">{label}</span>{active && <div className="w-1 h-1 bg-indigo-600 rounded-full mt-1" />}</button>);
  const StatCard = ({ label, value, color, onClick }) => (<button onClick={onClick} className={`${color} p-4 rounded-2xl flex flex-col justify-between h-24 shadow-sm text-left active:scale-95 transition-transform w-full`}><span className="text-xs font-bold uppercase opacity-80">{label}</span><span className="text-2xl font-black">{value}</span></button>);
  const EmptyState = ({ icon, text }) => (<div className="text-center py-20 text-slate-400"><div className="mx-auto mb-4 opacity-20 flex justify-center">{icon}</div><p className="text-sm">{text}</p></div>);
  
  export default App;
