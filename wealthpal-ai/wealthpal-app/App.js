import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, FlatList, ActivityIndicator,
  Animated, Dimensions, Switch, StatusBar, Modal,
} from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const { width: SW } = Dimensions.get('window');
const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

function deriveSurfaces(bg) {
  const n = parseInt(bg.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lift1 = (v) => Math.min(255, v + 22);
  const lift2 = (v) => Math.min(255, v + 38);
  const lift3 = (v) => Math.min(255, v + 72);
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return {
    surface: toHex(lift1(r), lift1(g), lift1(b)),
    surface2: toHex(lift2(r), lift2(g), lift2(b)),
    border: toHex(lift3(r), lift3(g), lift3(b)),
  };
}

const BASE = {
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  text: '#eef2ff',
  textSub: '#9bb5d0',
  textMuted: '#5a7a9e',
};

// Primary = background dark color, Secondary = accent/highlight color
const BG_OPTIONS = [
  { hex: '#060c17', label: 'Midnight' },
  { hex: '#0a0a0a', label: 'Obsidian' },
  { hex: '#0d1117', label: 'GitHub Dark' },
  { hex: '#0f1923', label: 'Navy' },
  { hex: '#111827', label: 'Slate' },
  { hex: '#1a0a2e', label: 'Deep Purple' },
  { hex: '#0c1a0c', label: 'Forest' },
  { hex: '#1a0c0c', label: 'Crimson Dark' },
  // Lighter options
  { hex: '#1e2d3d', label: 'Steel Blue' },
  { hex: '#1f2937', label: 'Cool Gray' },
  { hex: '#232b3a', label: 'Denim' },
  { hex: '#1e1b2e', label: 'Velvet' },
  { hex: '#1a2520', label: 'Pine' },
  { hex: '#2d1f1f', label: 'Burgundy' },
  { hex: '#263340', label: 'Arctic' },
  { hex: '#2a2418', label: 'Mocha' },
];
const ACCENT_OPTIONS = [
  '#7c3aed','#3b82f6','#10b981','#ef4444','#f59e0b','#ec4899','#06b6d4','#f97316',
  '#a855f7','#60a5fa','#34d399','#fb7185','#fbbf24','#f472b6','#22d3ee','#fb923c',
];

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const PLAID_CATEGORIES = [
  { key: 'FOOD_AND_DRINK', label: 'Food & Drink', icon: 'F' },
  { key: 'GENERAL_MERCHANDISE', label: 'Shopping', icon: 'S' },
  { key: 'TRANSPORTATION', label: 'Transportation', icon: 'T' },
  { key: 'TRAVEL', label: 'Travel', icon: '✈' },
  { key: 'ENTERTAINMENT', label: 'Entertainment', icon: 'E' },
  { key: 'PERSONAL_CARE', label: 'Personal Care', icon: 'P' },
  { key: 'MEDICAL', label: 'Medical', icon: '+' },
  { key: 'RENT_AND_UTILITIES', label: 'Rent & Utilities', icon: 'U' },
  { key: 'HOME_IMPROVEMENT', label: 'Home Improvement', icon: 'H' },
  { key: 'GENERAL_SERVICES', label: 'General Services', icon: 'G' },
  { key: 'LOAN_PAYMENTS', label: 'Loan Payments', icon: '$' },
  { key: 'BANK_FEES', label: 'Bank Fees', icon: 'B' },
  { key: 'OTHER', label: 'Other', icon: 'O' },
];

const RANGE_LABELS = {
  '7d': 'Last 7 Days', '30d': 'Last 30 Days',
  '3m': 'Last 3 Months', '6m': 'Last 6 Months', 'all': 'All Time',
};

const SORT_LABELS = {
  'date_desc': 'Date: Newest First', 'date_asc': 'Date: Oldest First',
  'amount_desc': 'Amount: High to Low', 'amount_asc': 'Amount: Low to High',
  'merchant': 'Name A–Z', 'category': 'Category A–Z',
};

const CAT_LETTERS = {
  Groceries: 'G', 'Food and Drink': 'F', Food: 'F', Restaurants: 'R',
  Gas: 'G', Transportation: 'T', Travel: 'T', Shopping: 'S',
  Entertainment: 'E', Subscriptions: 'S', Utilities: 'U',
  Health: 'H', Healthcare: 'H', Other: 'O',
  FOOD_AND_DRINK: 'F', GENERAL_MERCHANDISE: 'S', TRANSPORTATION: 'T',
  TRAVEL: '✈', ENTERTAINMENT: 'E', PERSONAL_CARE: 'P', MEDICAL: '+',
  RENT_AND_UTILITIES: 'U', HOME_IMPROVEMENT: 'H', GENERAL_SERVICES: 'G',
  LOAN_PAYMENTS: '$', BANK_FEES: 'B',
};

const CAT_BG = {
  Groceries: '#059669', 'Food and Drink': '#d97706', Food: '#d97706',
  Restaurants: '#d97706', Gas: '#2563eb', Transportation: '#2563eb',
  Travel: '#7c3aed', Shopping: '#db2777', Entertainment: '#dc2626',
  Subscriptions: '#0891b2', Utilities: '#65a30d', Health: '#059669',
  Healthcare: '#059669', Other: '#475569',
  FOOD_AND_DRINK: '#d97706', GENERAL_MERCHANDISE: '#db2777', TRANSPORTATION: '#2563eb',
  TRAVEL: '#7c3aed', ENTERTAINMENT: '#dc2626', PERSONAL_CARE: '#0891b2',
  MEDICAL: '#059669', RENT_AND_UTILITIES: '#65a30d', HOME_IMPROVEMENT: '#b45309',
  GENERAL_SERVICES: '#6366f1', LOAN_PAYMENTS: '#ef4444', BANK_FEES: '#64748b',
};

// Icon component — colored rounded square with a letter/symbol
function Icon({ char, color = '#7c3aed', size = 36, radius }) {
  const r = radius !== undefined ? radius : size * 0.28;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.44, fontWeight: '700', lineHeight: size * 0.52 }}>{char}</Text>
    </View>
  );
}

// Category icon for transaction rows
function CatIcon({ category }) {
  const letter = CAT_LETTERS[category] || (category?.[0]?.toUpperCase() || '?');
  const bg = CAT_BG[category] || '#475569';
  return <Icon char={letter} color={bg} size={42} radius={12} />;
}

function fmtMoney(n) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  const parts = v.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function App() {
  // Splash
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.85)).current;

  // Auth
  const [screen, setScreen] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userId, setUserId] = useState(null);
  const userIdRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // App state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Plaid
  const [linkedAccount, setLinkedAccount] = useState(null);
  const [plaidStatus, setPlaidStatus] = useState('');
  const [plaidError, setPlaidError] = useState('');
  const [plaidLoading, setPlaidLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([
    { id: '0', role: 'assistant', text: "Hi! I'm your WealthPal AI assistant. Ask me anything about your finances!" },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(320)).current;
  const overlayO = useRef(new Animated.Value(0)).current;

  // Theme — Primary=background, Secondary=accent
  const [themeBg, setThemeBg] = useState('#060c17');
  const [themeAccent, setThemeAccent] = useState('#7c3aed');

  const C = useMemo(() => {
    const surfaces = deriveSurfaces(themeBg);
    return { ...BASE, ...surfaces, bg: themeBg, accent: themeAccent, blue: '#3b82f6' };
  }, [themeBg, themeAccent]);
  const CAT_COLORS = useMemo(() => [C.accent, C.blue, C.green, C.amber, C.red], [C]);
  const CHART_CFG = useMemo(() => ({
    backgroundColor: C.surface, backgroundGradientFrom: C.surface, backgroundGradientTo: C.surface,
    decimalPlaces: 0,
    color: (o = 1) => `rgba(${hexToRgb(C.accent)},${o})`,
    labelColor: () => C.textSub,
    propsForDots: { r: '4', strokeWidth: '2', stroke: C.accent },
    propsForBackgroundLines: { stroke: C.border },
  }), [C]);
  const s = useMemo(() => makeStyles(C), [C]);

  const monthlySpend = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return transactions
      .filter(tx => new Date(tx.transaction_date).getTime() >= cutoff)
      .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
  }, [transactions]);


  // Notifications
  const [notifOverall, setNotifOverall] = useState(false);
  const [notifDaily, setNotifDaily] = useState(false);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [notifMonthly, setNotifMonthly] = useState(false);
  const [notifBudget, setNotifBudget] = useState(false);
  const [notifIds, setNotifIds] = useState({});

  // Tutorial
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const TUTORIAL_STEPS = [
    { icon: '⌂', color: '#7c3aed', title: 'Welcome to WealthPal AI', body: 'Your smart financial companion. We\'ll walk you through the key features to get you started.' },
    { icon: 'B', color: '#3b82f6', title: 'Connect Your Bank', body: 'Tap the ⚙ gear icon in the top right and select "Connect Bank" to securely link your accounts via Plaid.' },
    { icon: '≡', color: '#10b981', title: 'View Transactions', body: 'The Txns tab shows all your transactions. Use Sort to organize by date, amount, or category. Tap any transaction to edit it.' },
    { icon: '◈', color: '#f59e0b', title: 'Get Insights', body: 'The Insights tab shows spending charts and breakdowns by category. Tap categories to filter the chart.' },
    { icon: '✦', color: '#ec4899', title: 'Ask the AI', body: 'The AI tab is your personal finance advisor. Ask anything — "How much did I spend last week?" or "Where can I cut back?"' },
    { icon: '☰', color: '#06b6d4', title: 'More Features', body: 'The More tab has Goals, Groups, Budget, Net Worth, and Credit Score. Set budgets and goals to stay on track!' },
  ];

  // Settings
  const [biometrics, setBiometrics] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [widgetInfoVisible, setWidgetInfoVisible] = useState(false);

  // Chart type for insights
  const [chartType, setChartType] = useState('line');

  // Insights filters
  const [insightsRange, setInsightsRange] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Transaction edit
  const [editTxVisible, setEditTxVisible] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editTxFields, setEditTxFields] = useState({});
  const [savingTx, setSavingTx] = useState(false);

  // Goals
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [addGoalVisible, setAddGoalVisible] = useState(false);
  const [addGoalType, setAddGoalType] = useState('savings');
  const [addGoalUpdateMode, setAddGoalUpdateMode] = useState('manual');
  const [newGoal, setNewGoal] = useState({});
  const [savingGoal, setSavingGoal] = useState(false);

  // Groups
  const [groupMode, setGroupMode] = useState(false);
  const [groupsVisible, setGroupsVisible] = useState(false);
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState({ members: [], goals: [] });
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addGroupGoalVisible, setAddGroupGoalVisible] = useState(false);
  const [newGroupGoal, setNewGroupGoal] = useState({});

  // Edit profile
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  // Customize theme
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Budgets
  const [budgets, setBudgets] = useState([]);
  const [addBudgetVisible, setAddBudgetVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newBudgetCat, setNewBudgetCat] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [newBudgetPeriod, setNewBudgetPeriod] = useState('monthly');
  const [newBudgetPaycycleStart, setNewBudgetPaycycleStart] = useState('');
  const [newBudgetPaycycleFreq, setNewBudgetPaycycleFreq] = useState('biweekly');
  const [savingBudget, setSavingBudget] = useState(false);

  // Transactions sort
  const [txSortBy, setTxSortBy] = useState('date_desc');
  const [txSortDropdownVisible, setTxSortDropdownVisible] = useState(false);
  const [txFilterCategory, setTxFilterCategory] = useState('all');
  const [txFilterDropdownVisible, setTxFilterDropdownVisible] = useState(false);
  const [insightsCatFilter, setInsightsCatFilter] = useState('all');
  const [insightsCatDropdownVisible, setInsightsCatDropdownVisible] = useState(false);

  // More tab sub-section + group share loading — MUST be declared here (before any early returns)
  const [moreSection, setMoreSection] = useState(null);
  const [groupShareLoading, setGroupShareLoading] = useState(false);

  const sortedTransactions = useMemo(() => {
    const txs = txFilterCategory === 'all'
      ? [...transactions]
      : transactions.filter(tx => tx.category === txFilterCategory);
    switch (txSortBy) {
      case 'date_asc':    return txs.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
      case 'amount_desc': return txs.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
      case 'amount_asc':  return txs.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
      case 'merchant':    return txs.sort((a, b) => (a.merchant_name || '').localeCompare(b.merchant_name || ''));
      case 'category':    return txs.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      default:            return txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    }
  }, [transactions, txSortBy, txFilterCategory]);

  // Insights dropdown
  const [insightsDropdownVisible, setInsightsDropdownVisible] = useState(false);

  // Groups shared data
  const [groupSharedTx, setGroupSharedTx] = useState([]);

  // ── Theme + persisted prefs ──────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet([
      'themeBg', 'themeAccent', 'displayName',
      'notifOverall', 'notifDaily', 'notifWeekly', 'notifMonthly', 'notifBudget',
    ]).then(pairs => {
      const m = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (m.themeBg) setThemeBg(m.themeBg);
      if (m.themeAccent) setThemeAccent(m.themeAccent);
      if (m.displayName) setDisplayName(m.displayName);
      if (m.notifOverall !== null) setNotifOverall(m.notifOverall === 'true');
      if (m.notifDaily !== null) setNotifDaily(m.notifDaily === 'true');
      if (m.notifWeekly !== null) setNotifWeekly(m.notifWeekly === 'true');
      if (m.notifMonthly !== null) setNotifMonthly(m.notifMonthly === 'true');
      if (m.notifBudget !== null) setNotifBudget(m.notifBudget === 'true');
    });
  }, []);

  const changeBg = (color) => { setThemeBg(color); AsyncStorage.setItem('themeBg', color); };
  const changeAccent = (color) => { setThemeAccent(color); AsyncStorage.setItem('themeAccent', color); };

  // ── Splash ──────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(splashOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(splashScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(splashOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
        .start(() => setShowSplash(false));
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  // ── Drawer ──────────────────────────────────────────
  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 0, duration: 270, useNativeDriver: true }),
      Animated.timing(overlayO, { toValue: 1, duration: 270, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(drawerX, { toValue: 320, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayO, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  };

  // ── Auth ────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      const uid = data.session.user.id;
      const firstName = data.first_name || data.session.user.user_metadata?.full_name?.split(' ')[0] || email.split('@')[0];
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(firstName);
      AsyncStorage.setItem('displayName', firstName);
      setPassword('');
      setDashboardLoading(true);
      try {
        const s = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (s.ok) setDashboardData(await s.json());
      } catch { setDashboardData({ monthly_spending: 0, top_categories: [] }); }
      setScreen('dashboard');
      setDashboardLoading(false);
      fetchAccounts(uid);
      fetchTransactions(uid);
      fetchGoals(uid);
      fetchGroups(uid);
      fetchBudgets(uid);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  // ✅ FIXED: Added fetchAccounts and fetchTransactions calls
  const handleSignup = async () => {
    if (!email || !password || !firstName || !lastName) {
      setError('Please fill in all fields'); return;
    }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); return; }
      const uid = data.user.id;
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(firstName.trim());
      AsyncStorage.setItem('displayName', firstName.trim());
      setPassword(''); setFirstName(''); setLastName('');
      setDashboardLoading(true);
      try {
        const s = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (s.ok) setDashboardData(await s.json());
      } catch { setDashboardData({ monthly_spending: 0, top_categories: [] }); }
      setScreen('dashboard');
      setDashboardLoading(false);
      fetchAccounts(uid);
      fetchTransactions(uid);
      fetchGoals(uid);
      fetchGroups(uid);
      fetchBudgets(uid);
      // Show tutorial for new users
      setTimeout(() => { setTutorialStep(0); setTutorialVisible(true); }, 600);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => {
      setScreen('login'); setUserId(null); userIdRef.current = null;
      setEmail(''); setPassword(''); setFirstName(''); setLastName('');
      setDisplayName(''); setError('');
      AsyncStorage.removeItem('displayName');
      setTransactions([]); setAccounts([]); setSelectedAccount(null);
      setLinkedAccount(null); setAccountsError(false); setDashboardData(null);
      setChatMessages([{ id: '0', role: 'assistant', text: "Hi! I'm your WealthPal AI assistant. Ask me anything about your finances!" }]);
    }, 300);
  };

  // ── Data ────────────────────────────────────────────
  const fetchAccounts = async (uid) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    setLoadingAccounts(true); setAccountsError(false);
    try {
      const res = await fetch(`${API_URL}/api/plaid/accounts/${id}`);
      if (!res.ok) { setAccountsError(true); return; }
      const data = await res.json();
      if (data.accounts?.length > 0) {
        setAccounts(data.accounts);
        setSelectedAccount(data.accounts[0]);
        setLinkedAccount(data.itemId);
        setAccountsError(false);
      } else {
        setAccountsError(true);
      }
    } catch { setAccountsError(true); }
    finally { setLoadingAccounts(false); }
  };

  const fetchTransactions = async (uid) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    setLoadingTx(true);
    try {
      const res = await fetch(`${API_URL}/api/transactions/${id}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch {}
    finally { setLoadingTx(false); }
  };

  const syncTransactions = async () => {
    if (!userIdRef.current) return;
    setSyncing(true); setSyncError('');
    try {
      const res = await fetch(`${API_URL}/api/transactions/sync/${userIdRef.current}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || 'Sync failed');
      } else {
        if (data.total === 0) setSyncError('Plaid returned 0 transactions. Try reconnecting your bank.');
        else if (data.synced === 0 && data.total > 0) setSyncError(`Failed to save transactions (0/${data.total} saved). Check server logs.`);
        else setSyncError('');
        await fetchTransactions();
        autoUpdateGoals();
      }
    } catch (e) { setSyncError('Network error — could not reach server'); }
    finally { setSyncing(false); }
  };

  const refreshAll = async () => {
    await fetchAccounts();
    await fetchTransactions();
  };

  const openEditProfile = () => {
    const parts = displayName ? displayName.split(' ') : [];
    setEditFirst(parts[0] || '');
    setEditLast(parts.slice(1).join(' ') || '');
    setProfileError('');
    setEditProfileVisible(true);
  };

  const saveProfile = async () => {
    if (!editFirst.trim()) { setProfileError('First name is required'); return; }
    setSavingProfile(true); setProfileError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/profile/${userIdRef.current}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: editFirst.trim(), lastName: editLast.trim(), email }),
      });
      const data = await res.json();
      if (!res.ok) { setProfileError(data.error || 'Failed to save profile'); return; }
      setDisplayName(editFirst.trim());
      AsyncStorage.setItem('displayName', editFirst.trim());
      setEditProfileVisible(false);
    } catch { setProfileError('Could not connect to server'); }
    finally { setSavingProfile(false); }
  };

  // ── Notifications ────────────────────────────────────
  const requestNotifPermission = async () => {
    if (!Device.isDevice) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  const cancelNotif = async (key) => {
    const id = notifIds[key];
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      setNotifIds(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const scheduleNotif = async (key, title, triggerConfig) => {
    const granted = await requestNotifPermission();
    if (!granted) return;
    await cancelNotif(key);
    let body = `You've spent $${fmtMoney(monthlySpend)} in the last 30 days across ${transactions.length} transactions.`;
    try {
      const res = await fetch(`${API_URL}/api/ai/notification-summary/${userIdRef.current}`);
      if (res.ok) { const d = await res.json(); body = d.summary || body; }
    } catch { /* use fallback body */ }
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: triggerConfig,
    });
    setNotifIds(prev => ({ ...prev, [key]: id }));
    AsyncStorage.setItem(`notifId_${key}`, id);
  };

  const checkBudgetAlerts = () => {
    budgets.forEach(b => {
      const start = getPeriodStart(b.period || 'monthly', b.paycycle_start, b.paycycle_freq);
      const spent = transactions
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === b.category)
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      const limit = parseFloat(b.monthly_limit || 0);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const catLabel = PLAID_CATEGORIES.find(c => c.key === b.category)?.label || b.category;
      if (pct >= 90) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: pct >= 100 ? `Budget Exceeded: ${catLabel}` : `Budget Alert: ${catLabel}`,
            body: pct >= 100
              ? `You've spent $${fmtMoney(spent)} — $${fmtMoney(spent - limit)} over your $${fmtMoney(limit)} limit.`
              : `You've used ${Math.round(pct)}% of your $${fmtMoney(limit)} budget ($${fmtMoney(spent)} spent).`,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      }
    });
  };

  const toggleNotifBudget = async (val) => {
    setNotifBudget(val);
    AsyncStorage.setItem('notifBudget', String(val));
    if (val) {
      const granted = await requestNotifPermission();
      if (granted) checkBudgetAlerts();
    }
  };

  const toggleNotifOverall = async (val) => {
    setNotifOverall(val);
    AsyncStorage.setItem('notifOverall', String(val));
    if (!val) {
      ['daily', 'weekly', 'monthly'].forEach(k => cancelNotif(k));
    }
  };

  const toggleNotifPeriod = async (period, val) => {
    const setters = { daily: setNotifDaily, weekly: setNotifWeekly, monthly: setNotifMonthly };
    setters[period](val);
    AsyncStorage.setItem(`notif${period.charAt(0).toUpperCase() + period.slice(1)}`, String(val));
    if (!val) { cancelNotif(period); return; }
    const triggers = {
      daily:   { hour: 9, minute: 0, repeats: true },
      weekly:  { weekday: 2, hour: 9, minute: 0, repeats: true },
      monthly: { day: 1, hour: 9, minute: 0, repeats: true },
    };
    const titles = {
      daily:   '📊 Daily Spending Summary',
      weekly:  '📈 Weekly Spending Summary',
      monthly: '📅 Monthly Spending Report',
    };
    await scheduleNotif(period, titles[period], triggers[period]);
  };

  // ── Plaid ───────────────────────────────────────────
  const openPlaidLink = async () => {
    if (!userId) { setPlaidError('Please log in first'); return; }
    setPlaidLoading(true); setPlaidError(''); setPlaidStatus('');
    try {
      const res = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!data.link_token) throw new Error('Failed to get link token');
      create({ token: data.link_token, noLoadingState: false });
      open({
        onSuccess: async (success) => {
          try {
            const er = await fetch(`${API_URL}/api/plaid/exchange-token`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publicToken: success.publicToken, userId }),
            });
            const ed = await er.json();
            if (!er.ok) throw new Error(ed.error || 'Exchange failed');
            setLinkedAccount(ed.plaid_account_id || ed.itemId);
            setPlaidStatus('Bank connected successfully!');
            setPlaidError('');
            // Small delay to let DB write settle, then fetch
            await new Promise(r => setTimeout(r, 800));
            await fetchAccounts();
            await syncTransactions();
            // ✅ Already has fetchTransactions call
            await fetchTransactions(userIdRef.current);
          } catch (err) { setPlaidError(err.message); }
          finally { setPlaidLoading(false); }
        },
        onExit: (exit) => {
          if (exit?.error) setPlaidError(exit.error.display_message || 'Connection failed');
          setPlaidStatus(''); setPlaidLoading(false);
        },
      });
    } catch (err) { setPlaidError(err.message); setPlaidLoading(false); }
  };

  // ── Chat ────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatMessages(p => [...p, { id: Date.now().toString(), role: 'user', text: msg }]);
    setChatInput(''); setLoadingChat(true);
    // Send device's local date so server uses the user's actual calendar day
    const localToday = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local TZ
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: msg, today: localToday }),
      });
      const data = await res.json();
      setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.response || 'Sorry, I had trouble with that.' }]);
    } catch {
      setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally { setLoadingChat(false); }
  };

  // ── Goals / Groups fetch ─────────────────────────────
  const fetchGoals = async (uid) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    setGoalsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/goals/${id}`);
      const d = await res.json();
      setGoals(d.goals || []);
    } catch {}
    finally { setGoalsLoading(false); }
  };

  const fetchGroups = async (uid) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/groups/${id}`);
      const d = await res.json();
      setGroups(d.groups || []);
    } catch {}
  };

  const fetchGroupDetail = async (groupId) => {
    try {
      const [detailRes, sharedRes] = await Promise.all([
        fetch(`${API_URL}/api/groups/${groupId}/detail`),
        fetch(`${API_URL}/api/groups/${groupId}/shared-transactions`),
      ]);
      if (detailRes.ok) setGroupDetail(await detailRes.json());
      if (sharedRes.ok) { const d = await sharedRes.json(); setGroupSharedTx(d.transactions || []); }
    } catch {}
  };

  const fetchGroupSharedTx = async (groupId) => {
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/shared-transactions`);
      const d = await res.json();
      setGroupSharedTx(d.transactions || []);
    } catch {}
  };

  const fetchBudgets = async (uid) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/api/budgets/${id}`);
      const d = await res.json();
      setBudgets(d.budgets || []);
    } catch {}
  };

  const autoUpdateGoals = async () => {
    const autoGoals = goals.filter(g => g.update_mode === 'auto' && !g.is_completed);
    if (!autoGoals.length) return;
    for (const goal of autoGoals) {
      let total = 0;
      if (goal.type === 'savings') {
        total = transactions
          .filter(tx => {
            const cat = (tx.category || '').toLowerCase();
            const merch = (tx.merchant_name || '').toLowerCase();
            return cat.includes('transfer') || cat.includes('saving') || merch.includes('saving');
          })
          .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      } else if (goal.type === 'debt_payoff') {
        const kw = (goal.title || '').toLowerCase().split(' ')[0];
        total = transactions
          .filter(tx => {
            const cat = (tx.category || '').toLowerCase();
            const merch = (tx.merchant_name || '').toLowerCase();
            return cat.includes('payment') || cat.includes('loan') || (kw.length > 2 && merch.includes(kw));
          })
          .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      }
      if (Math.abs(total - goal.current_amount) > 0.01) {
        await fetch(`${API_URL}/api/goals/${goal.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_amount: total, is_completed: goal.target_amount > 0 && total >= goal.target_amount }),
        });
      }
    }
    fetchGoals();
  };

  const getPeriodStart = (period, paycycleStart, paycycleFreq) => {
    const now = new Date();
    if (period === 'weekly') { const d = new Date(now); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; }
    if (period === 'biweekly') { const d = new Date(now); d.setDate(d.getDate() - 13); return d.toISOString().split('T')[0]; }
    if (period === 'paycycle' && paycycleStart) {
      const freqDays = paycycleFreq === 'weekly' ? 7 : paycycleFreq === 'biweekly' ? 14 : 30;
      const anchor = new Date(paycycleStart);
      const msPerCycle = freqDays * 86400000;
      const elapsed = now.getTime() - anchor.getTime();
      const cycleOffset = elapsed % msPerCycle;
      const cycleStart = new Date(now.getTime() - cycleOffset);
      return cycleStart.toISOString().split('T')[0];
    }
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // monthly
  };

  // ── Insight helpers ─────────────────────────────────
  const getFilteredTx = () => {
    const ranges = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, 'all': 99999 };
    const days = ranges[insightsRange] || 30;
    const cutoff = Date.now() - days * 86400000;
    let txs = transactions.filter(tx => new Date(tx.transaction_date).getTime() >= cutoff);
    if (insightsCatFilter !== 'all') txs = txs.filter(tx => tx.category === insightsCatFilter);
    return txs;
  };

  const getCatData = () => {
    const txs = getFilteredTx();
    if (!txs.length) return null;
    const m = {};
    txs.forEach(tx => { const c = tx.category || 'Other'; m[c] = (m[c] || 0) + parseFloat(tx.amount || 0); });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 5);
  };

  const getChartData = () => {
    const txs = selectedCategory
      ? getFilteredTx().filter(tx => tx.category === selectedCategory)
      : getFilteredTx();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();

    if (insightsRange === '7d') {
      const labels = [], data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        labels.push(['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]);
        data.push(txs.filter(tx => tx.transaction_date === key).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
      }
      return { labels, data };
    }

    if (insightsRange === '30d') {
      const labels = [], data = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date(now); end.setDate(end.getDate() - i * 7);
        const start = new Date(end); start.setDate(start.getDate() - 7);
        labels.push(`${end.getMonth()+1}/${end.getDate()}`);
        data.push(txs.filter(tx => {
          const t = new Date(tx.transaction_date).getTime();
          return t > start.getTime() && t <= end.getTime() + 86400000;
        }).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
      }
      return { labels, data };
    }

    if (insightsRange === '3m' || insightsRange === '6m') {
      const count = insightsRange === '3m' ? 3 : 6;
      const months = {}, labels = [];
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        labels.push(monthNames[d.getMonth()]);
        months[key] = 0;
      }
      txs.forEach(tx => {
        const key = (tx.transaction_date || '').slice(0, 7);
        if (months[key] !== undefined) months[key] += parseFloat(tx.amount || 0);
      });
      return { labels, data: Object.values(months) };
    }

    // 'all' — monthly buckets for all available data
    if (!txs.length) return { labels: ['No data'], data: [0] };
    const monthSet = {};
    txs.forEach(tx => {
      const key = (tx.transaction_date || '').slice(0, 7);
      if (key) monthSet[key] = (monthSet[key] || 0) + parseFloat(tx.amount || 0);
    });
    const sorted = Object.keys(monthSet).sort();
    return {
      labels: sorted.map(k => monthNames[parseInt(k.split('-')[1]) - 1]),
      data: sorted.map(k => monthSet[k]),
    };
  };

  // ════════════════════════════════════════════════════
  // SPLASH
  // ════════════════════════════════════════════════════
  if (showSplash) {
    return (
      <View style={s.splashBg}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }], alignItems: 'center' }}>
          <View style={s.splashIcon}><Text style={s.splashIconText}>W</Text></View>
          <Text style={s.splashTitle}>WealthPal AI</Text>
          <Text style={s.splashSub}>Your Smart Finance Companion</Text>
          <ActivityIndicator color={C.accent} style={{ marginTop: 32 }} />
        </Animated.View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════════════
  if (screen === 'login') {
    return (
      <View style={s.bg}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ScrollView contentContainerStyle={s.authScroll}>
          <View style={s.authTop}>
            <View style={s.splashIcon}><Text style={s.splashIconText}>W</Text></View>
            <Text style={s.authTitle}>WealthPal AI</Text>
            <Text style={s.authSub}>Sign in to your account</Text>
          </View>
          {!!error && <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>}
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} placeholder="••••••••" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
          <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setScreen('signup'); setError(''); }} style={s.linkRow}>
            <Text style={s.linkText}>Don't have an account? <Text style={s.linkAccent}>Sign up</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'signup') {
    return (
      <View style={s.bg}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ScrollView contentContainerStyle={s.authScroll}>
          <View style={s.authTop}>
            <Text style={s.authTitle}>Create Account</Text>
            <Text style={s.authSub}>Join WealthPal AI today</Text>
          </View>
          {!!error && <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>}
          <View style={s.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>First Name</Text>
              <TextInput style={s.input} placeholder="John" placeholderTextColor={C.textMuted} value={firstName} onChangeText={setFirstName} editable={!loading} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Last Name</Text>
              <TextInput style={s.input} placeholder="Doe" placeholderTextColor={C.textMuted} value={lastName} onChangeText={setLastName} editable={!loading} />
            </View>
          </View>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} placeholder="Min. 6 characters" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
          <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setScreen('login'); setError(''); }} style={s.linkRow}>
            <Text style={s.linkText}>Already have an account? <Text style={s.linkAccent}>Sign in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (dashboardLoading) {
    return (
      <View style={[s.bg, s.center]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={[s.subText, { marginTop: 16 }]}>Loading your finances...</Text>
      </View>
    );
  }

  // ════════════════════════════════════════════════════
  // DASHBOARD TAB
  // ════════════════════════════════════════════════════
  const renderDashboard = () => {
    const recentTx = transactions.slice(0, 3);
    const weekSpend = transactions
      .filter(tx => (tx.transaction_date || '') >= new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0])
      .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={s.balanceCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>{selectedAccount ? selectedAccount.name : 'Total Balance'}</Text>
              <Text style={s.balanceAmt}>${fmtMoney(selectedAccount?.balances?.current || 0)}</Text>
              <Text style={s.balanceSub}>{selectedAccount ? `${selectedAccount.subtype} · ${selectedAccount.type}` : 'Connect a bank to get started'}</Text>
            </View>
            {(loadingAccounts || loadingTx) ? (
              <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" style={{ marginTop: 4 }} />
            ) : (
              <TouchableOpacity onPress={refreshAll} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>↺ Refresh</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Account selector */}
        {accounts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {accounts.map(acc => (
              <TouchableOpacity
                key={acc.account_id}
                style={[s.chip, selectedAccount?.account_id === acc.account_id && s.chipActive]}
                onPress={() => setSelectedAccount(acc)}
              >
                <Text style={[s.chipTitle, selectedAccount?.account_id === acc.account_id && s.chipTitleActive]}>{acc.name}</Text>
                <Text style={[s.chipSub, selectedAccount?.account_id === acc.account_id && { color: 'rgba(255,255,255,0.65)' }]}>${fmtMoney(acc.balances?.current || 0)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Bank reconnect prompt */}
        {accountsError && (
          <View style={s.reconnectCard}>
            <Text style={s.reconnectTitle}>Bank connection needs refresh</Text>
            <Text style={s.reconnectText}>Your bank connection has expired or needs to be re-linked.</Text>
            <TouchableOpacity style={[s.btn, { marginBottom: 0 }]} onPress={openDrawer}>
              <Text style={s.btnText}>Reconnect Bank</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderLeftWidth: 3, borderLeftColor: C.accent }]}>
            <Text style={s.statLabel}>30-Day Spend</Text>
            <Text style={s.statVal}>${fmtMoney(monthlySpend)}</Text>
            <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>Last 30 days</Text>
          </View>
          <View style={[s.statCard, { borderLeftWidth: 3, borderLeftColor: C.blue }]}>
            <Text style={s.statLabel}>7-Day Spend</Text>
            <Text style={s.statVal}>${fmtMoney(weekSpend)}</Text>
            <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>Last 7 days</Text>
          </View>
        </View>

        {/* Connect bank prompt */}
        {!linkedAccount && !accountsError && (
          <View style={s.connectCard}>
            <Text style={s.connectTitle}>Connect Your Bank</Text>
            <Text style={s.connectText}>Link your bank account to unlock spending insights, transaction history, and personalized AI advice.</Text>
            <TouchableOpacity style={s.btn} onPress={openDrawer}>
              <Text style={s.btnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent transactions preview */}
        {recentTx.length > 0 && (
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => setActiveTab('transactions')}>
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>See All ›</Text>
              </TouchableOpacity>
            </View>
            {recentTx.map((tx, i) => (
              <View key={tx.id || i} style={[s.txItem, { paddingVertical: 10 }]}>
                <CatIcon category={tx.category} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txMerchant} numberOfLines={1}>{tx.merchant_name || tx.description || 'Unknown'}</Text>
                  <Text style={s.txMeta}>{fmtDate(tx.transaction_date)} · {(tx.category || 'Other').replace(/_/g, ' ')}</Text>
                </View>
                <Text style={s.txAmt}>-${fmtMoney(tx.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {linkedAccount && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recommendations</Text>
            {transactions.length === 0 && (
              <TouchableOpacity
                style={[s.quickCard, { borderColor: C.green }]}
                onPress={syncTransactions}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon char="↻" color={C.green} size={40} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Sync Your Transactions</Text>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>Pull in your latest transactions for AI-powered insights.</Text>
                  </View>
                  <Text style={{ color: C.green, fontSize: 20 }}>›</Text>
                </View>
              </TouchableOpacity>
            )}
            {goals.length === 0 && (
              <TouchableOpacity
                style={[s.quickCard, { borderColor: C.accent }]}
                onPress={() => { setActiveTab('more'); }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon char="★" color={C.accent} size={40} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Set Your First Goal</Text>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>Track savings, debt payoff, spending habits, and more.</Text>
                  </View>
                  <Text style={{ color: C.accent, fontSize: 20 }}>›</Text>
                </View>
              </TouchableOpacity>
            )}
            {budgets.length === 0 && (
              <TouchableOpacity
                style={[s.quickCard, { borderColor: C.blue }]}
                onPress={() => { setActiveTab('more'); }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon char="◎" color={C.blue} size={40} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Create a Budget</Text>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>Set spending limits by category and period to stay on track.</Text>
                  </View>
                  <Text style={{ color: C.blue, fontSize: 20 }}>›</Text>
                </View>
              </TouchableOpacity>
            )}
            {(() => {
              const overBudget = budgets.filter(b => {
                const start = getPeriodStart(b.period || 'monthly');
                const spent = transactions.filter(tx => (tx.transaction_date || '') >= start && tx.category === b.category).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
                return spent > parseFloat(b.monthly_limit || 0);
              });
              return overBudget.length > 0 ? (
                <TouchableOpacity
                  style={[s.quickCard, { borderColor: C.red }]}
                  onPress={() => { setActiveTab('more'); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Icon char="!" color={C.red} size={40} radius={12} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>{overBudget.length} Budget{overBudget.length > 1 ? 's' : ''} Over Limit</Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{overBudget.map(b => b.category.replace(/_/g, ' ')).join(', ')} — review your spending.</Text>
                    </View>
                    <Text style={{ color: C.red, fontSize: 20 }}>›</Text>
                  </View>
                </TouchableOpacity>
              ) : null;
            })()}
            <TouchableOpacity
              style={[s.quickCard, { borderColor: C.accent }]}
              onPress={() => setActiveTab('chat')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon char="✦" color={C.accent} size={40} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Ask WealthPal AI</Text>
                  <Text style={{ color: C.textSub, fontSize: 12 }}>Get personalized advice based on your real spending data.</Text>
                </View>
                <Text style={{ color: C.accent, fontSize: 20 }}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════
  // INSIGHTS TAB
  // ════════════════════════════════════════════════════
  const renderInsights = () => {
    const filteredTx = getFilteredTx();
    const catData = getCatData();
    const { labels: chartLabels, data: chartRawData } = getChartData();
    const chartData = chartRawData.map(v => Math.max(0.01, v));
    const total = filteredTx.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    const avg = filteredTx.length ? total / filteredTx.length : 0;
    const maxTx = filteredTx.reduce((m, tx) => parseFloat(tx.amount) > parseFloat(m?.amount || 0) ? tx : m, null);
    const merchantCount = {};
    filteredTx.forEach(tx => { const m = tx.merchant_name || 'Unknown'; merchantCount[m] = (merchantCount[m] || 0) + 1; });
    const topMerchant = Object.entries(merchantCount).sort(([,a],[,b]) => b - a)[0];
    const dailyAvg = filteredTx.length && insightsRange !== 'all'
      ? total / ({ '7d': 7, '30d': 30, '3m': 90, '6m': 180 }[insightsRange] || 30)
      : null;

    if (!transactions.length) {
      return (
        <View style={[s.tab, s.center]}>
          <Icon char="%" color={C.accent} size={56} radius={16} />
          <Text style={[s.emptyTitle, { marginTop: 20 }]}>No insights yet</Text>
          <Text style={s.emptyText}>Connect your bank and sync transactions to see spending insights and charts.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        {/* Date range + category filter selectors */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setInsightsDropdownVisible(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: C.border }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15 }}>📅</Text>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{RANGE_LABELS[insightsRange]}</Text>
            </View>
            <Text style={{ color: C.textSub, fontSize: 18, lineHeight: 20 }}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setInsightsCatDropdownVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: insightsCatFilter !== 'all' ? C.accent + '22' : C.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: insightsCatFilter !== 'all' ? C.accent : C.border }}
          >
            <Text style={{ fontSize: 14 }}>⊟</Text>
            <Text style={{ color: insightsCatFilter !== 'all' ? C.accent : C.textSub, fontSize: 13, fontWeight: insightsCatFilter !== 'all' ? '700' : '400' }}>
              {insightsCatFilter === 'all' ? 'Category' : insightsCatFilter.replace(/_/g,' ').slice(0, 10)}
            </Text>
            <Text style={{ color: insightsCatFilter !== 'all' ? C.accent : C.textSub, fontSize: 16, lineHeight: 18 }}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          <View style={[s.statCard, { flex: 1, minWidth: '44%' }]}>
            <Text style={s.statLabel}>Total Spent</Text>
            <Text style={s.statVal}>${fmtMoney(total)}</Text>
          </View>
          <View style={[s.statCard, { flex: 1, minWidth: '44%' }]}>
            <Text style={s.statLabel}>Transactions</Text>
            <Text style={s.statVal}>{filteredTx.length}</Text>
          </View>
          <View style={[s.statCard, { flex: 1, minWidth: '44%' }]}>
            <Text style={s.statLabel}>Avg Transaction</Text>
            <Text style={s.statVal}>${fmtMoney(avg)}</Text>
          </View>
          {dailyAvg !== null && (
            <View style={[s.statCard, { flex: 1, minWidth: '44%' }]}>
              <Text style={s.statLabel}>Daily Average</Text>
              <Text style={s.statVal}>${fmtMoney(dailyAvg)}</Text>
            </View>
          )}
        </View>

        {/* Highlights row */}
        {(maxTx || topMerchant) && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {maxTx && (
              <View style={[s.insightCard, { flex: 1, flexDirection: 'column', gap: 4 }]}>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '600' }}>LARGEST PURCHASE</Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{maxTx.merchant_name || 'Unknown'}</Text>
                <Text style={{ color: C.red, fontSize: 15, fontWeight: '800' }}>${fmtMoney(maxTx.amount)}</Text>
              </View>
            )}
            {topMerchant && (
              <View style={[s.insightCard, { flex: 1, flexDirection: 'column', gap: 4 }]}>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '600' }}>MOST FREQUENT</Text>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{topMerchant[0]}</Text>
                <Text style={{ color: C.accent, fontSize: 15, fontWeight: '800' }}>{topMerchant[1]}x visits</Text>
              </View>
            )}
          </View>
        )}

        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View>
              <Text style={s.sectionTitle}>Spending Chart</Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Text style={{ color: C.accent, fontSize: 11, fontWeight: '600', marginTop: 2 }}>● {selectedCategory.replace(/_/g,' ')}  ✕ clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              {[['line', '↗'], ['bar', '▌▌'], ['pie', '◔']].map(([type, icon]) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setChartType(type)}
                  style={{ paddingHorizontal: 13, paddingVertical: 7, backgroundColor: chartType === type ? C.accent : 'transparent' }}
                >
                  <Text style={{ color: chartType === type ? '#fff' : C.textSub, fontSize: 13, fontWeight: '700' }}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.chartCard}>
            {chartType !== 'pie' && (
              <Text style={{ color: C.textMuted, fontSize: 11, alignSelf: 'flex-end', marginBottom: 4 }}>
                Total: ${fmtMoney(chartData.reduce((s, v) => s + (v === 0.01 ? 0 : v), 0))}
              </Text>
            )}
            {chartType === 'line' && (
              <LineChart
                data={{ labels: chartLabels, datasets: [{ data: chartData }] }}
                width={SW - 64} height={200} bezier
                chartConfig={{ ...CHART_CFG, decimalPlaces: 0, formatYLabel: (v) => '$' + (Number(v) >= 1000 ? (Number(v)/1000).toFixed(1)+'k' : v) }}
                style={{ borderRadius: 10, marginLeft: -16 }} withInnerLines={false} withDots
                yAxisLabel="" yAxisSuffix=""
              />
            )}
            {chartType === 'bar' && (
              <BarChart
                data={{ labels: chartLabels, datasets: [{ data: chartData }] }}
                width={SW - 64} height={200}
                chartConfig={{ ...CHART_CFG, decimalPlaces: 0, formatYLabel: (v) => '$' + (Number(v) >= 1000 ? (Number(v)/1000).toFixed(1)+'k' : v) }}
                style={{ borderRadius: 10, marginLeft: -16 }} withInnerLines={false}
                fromZero yAxisLabel="" yAxisSuffix=""
              />
            )}
            {chartType === 'pie' && catData && (
              <PieChart
                data={catData.map(([cat, amt], i) => ({
                  name: cat.replace(/_/g, ' ').slice(0, 12),
                  population: Math.round(amt * 100) / 100,
                  color: CAT_COLORS[i % CAT_COLORS.length],
                  legendFontColor: C.textSub, legendFontSize: 11,
                }))}
                width={SW - 64} height={200} chartConfig={CHART_CFG} accessor="population"
                backgroundColor="transparent" paddingLeft="8" absolute={false}
              />
            )}
          </View>
        </View>

        {catData && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 4 }]}>Spending by Category</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 14 }}>
              {chartType !== 'pie' ? 'Tap a category to filter the chart above' : 'Switch to line or bar chart to filter by category'}
            </Text>
            {catData.map(([cat, amt], i) => {
              const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
              const catTxCount = filteredTx.filter(tx => tx.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => chartType !== 'pie' ? setSelectedCategory(isSelected ? null : cat) : null}
                  activeOpacity={chartType !== 'pie' ? 0.7 : 1}
                  style={[s.insightCard, isSelected && { borderColor: CAT_COLORS[i % CAT_COLORS.length], borderWidth: 2 }]}
                >
                  <View style={[s.insightDot, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length], width: 12, height: 12, borderRadius: 6 }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.catInfo}>
                      <Text style={[s.catName, isSelected && { color: CAT_COLORS[i % CAT_COLORS.length] }]}>{cat.replace(/_/g,' ')}</Text>
                      <Text style={s.catAmt}>${fmtMoney(amt)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.bar, { width: `${pct}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]} />
                    </View>
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>{catTxCount} transaction{catTxCount !== 1 ? 's' : ''} · avg ${fmtMoney(amt / (catTxCount || 1))}</Text>
                  </View>
                  <Text style={[s.pct, { color: CAT_COLORS[i % CAT_COLORS.length] }]}>{pct}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {catData && catData[0] && (
          <View style={[s.highlightCard, { borderColor: CAT_COLORS[0], backgroundColor: C.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: CAT_COLORS[0], justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>1</Text>
              </View>
              <View>
                <Text style={s.highlightLabel}>Biggest Spending Category</Text>
                <Text style={s.highlightValue}>{catData[0][0].replace(/_/g,' ')}</Text>
              </View>
            </View>
            <Text style={s.highlightSub}>${fmtMoney(catData[0][1])} spent · {Math.round((catData[0][1] / total) * 100)}% of total · {filteredTx.filter(tx => tx.category === catData[0][0]).length} transactions</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════
  // TRANSACTIONS TAB
  // ════════════════════════════════════════════════════
  const renderTransactions = () => (
    <View style={{ flex: 1 }}>
      <View style={s.txTopBar}>
        <Text style={s.sectionTitle}>Transactions</Text>
        <TouchableOpacity style={s.syncBtn} onPress={syncTransactions} disabled={syncing || loadingTx}>
          {syncing ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Text style={s.syncText}>↻  Sync</Text>
          )}
        </TouchableOpacity>
      </View>
      {transactions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setTxSortDropdownVisible(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.textSub, fontSize: 13, marginRight: 4 }}>Sort:</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{SORT_LABELS[txSortBy]}</Text>
            <Text style={{ color: C.textSub, fontSize: 16, lineHeight: 18 }}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTxFilterDropdownVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: txFilterCategory !== 'all' ? C.accent + '22' : C.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: txFilterCategory !== 'all' ? C.accent : C.border }}
          >
            <Text style={{ color: txFilterCategory !== 'all' ? C.accent : C.textSub, fontSize: 13, fontWeight: txFilterCategory !== 'all' ? '700' : '400' }}>
              {txFilterCategory === 'all' ? '⊟ Filter' : `⊟ ${txFilterCategory.replace(/_/g,' ').slice(0,10)}`}
            </Text>
            <Text style={{ color: txFilterCategory !== 'all' ? C.accent : C.textSub, fontSize: 16, lineHeight: 18, marginLeft: 4 }}>▾</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!syncError && (
        <View style={[s.errBox, { margin: 16, marginTop: 4 }]}>
          <Text style={s.errText}>Sync error: {syncError}</Text>
        </View>
      )}
      {loadingTx ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
          <Text style={[s.subText, { marginTop: 12 }]}>Loading transactions...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={[s.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Icon char="$" color={C.textMuted} size={56} radius={16} />
          <Text style={[s.emptyTitle, { marginTop: 20 }]}>No transactions yet</Text>
          <Text style={s.emptyText}>Connect your bank and tap Sync to load your transaction history.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedTransactions}
          keyExtractor={(item, i) => item.id?.toString() || item.plaid_transaction_id || i.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.txItem}
              onPress={() => {
                setEditingTx(item);
                setEditTxFields({ merchant_name: item.merchant_name, amount: String(item.amount), category: item.category, transaction_date: item.transaction_date, description: item.description || '' });
                setEditTxVisible(true);
              }}
              activeOpacity={0.75}
            >
              <CatIcon category={item.category} />
              <View style={{ flex: 1 }}>
                <Text style={s.txMerchant} numberOfLines={1}>{item.merchant_name || item.description || 'Unknown'}</Text>
                <Text style={s.txMeta}>{fmtDate(item.transaction_date)} · {item.category || 'Other'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.txAmt}>-${fmtMoney(item.amount)}</Text>
                <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>tap to edit</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  // ════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════
  // GOALS TAB
  // ════════════════════════════════════════════════════
  const renderGoals = () => {
    const GOAL_TYPES = [
      { key: 'debt_payoff', label: 'Debt Payoff', icon: '⬇', color: C.red },
      { key: 'savings', label: 'Savings', icon: '★', color: C.green },
      { key: 'spending_behavior', label: 'Spending Behavior', icon: '◎', color: C.amber },
      { key: 'streak', label: 'Budget Streak', icon: '🔥', color: C.accent },
    ];
    const byType = (type) => goals.filter(g => g.type === type);
    const GoalCard = ({ goal }) => {
      const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
      const typeInfo = GOAL_TYPES.find(t => t.key === goal.type) || { color: C.accent, icon: '★' };
      return (
        <View style={{ backgroundColor: C.surface, borderRadius: 18, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          {/* Color accent stripe */}
          <View style={{ height: 4, backgroundColor: typeInfo.color }} />
          <View style={{ padding: 16 }}>
            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${typeInfo.color}22`, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 17 }}>{typeInfo.icon}</Text>
                </View>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{goal.title}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {goal.update_mode === 'auto' && (
                  <View style={{ backgroundColor: C.accent + '33', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700' }}>AUTO</Text>
                  </View>
                )}
                {goal.is_completed && (
                  <View style={{ backgroundColor: C.green + '33', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: C.green, fontSize: 10, fontWeight: '700' }}>✓ DONE</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Progress */}
            {goal.target_amount > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: C.textSub, fontSize: 13 }}>${fmtMoney(goal.current_amount)} <Text style={{ color: C.textMuted }}>of ${fmtMoney(goal.target_amount)}</Text></Text>
                  <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '800' }}>{pct}%</Text>
                </View>
                <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 4, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: typeInfo.color, borderRadius: 4 }} />
                </View>
                <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>${fmtMoney(goal.target_amount - goal.current_amount)} remaining</Text>
              </>
            )}
            {goal.type === 'streak' && (
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800' }}>{goal.streak_count || 0}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>CURRENT</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: C.textSub, fontSize: 22, fontWeight: '700' }}>{goal.streak_best || 0}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>BEST</Text>
                </View>
              </View>
            )}
            {goal.deadline && (
              <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>Target date: {fmtDate(goal.deadline)}</Text>
            )}
            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: typeInfo.color + '22', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}
                onPress={async () => {
                  const newAmt = goal.current_amount + 1;
                  await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_amount: newAmt, is_completed: newAmt >= goal.target_amount }) });
                  fetchGoals();
                }}
              >
                <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '700' }}>+ Update Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: C.red + '22', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center' }}
                onPress={async () => { await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'DELETE' }); fetchGoals(); }}
              >
                <Text style={{ color: C.red, fontSize: 13, fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    };
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>My Goals</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setNewGoal({}); setAddGoalType('savings'); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
            <Text style={s.syncText}>+ New Goal</Text>
          </TouchableOpacity>
        </View>
        {goalsLoading && <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />}
        {!goalsLoading && goals.length === 0 && (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="★" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No goals yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set debt payoff, savings, spending, or streak goals to stay on track.</Text>
            <TouchableOpacity style={s.btn} onPress={() => { setNewGoal({}); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
              <Text style={s.btnText}>Create First Goal</Text>
            </TouchableOpacity>
          </View>
        )}
        {GOAL_TYPES.map(({ key, label, icon, color }) => byType(key).length > 0 && (
          <View key={key} style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <Icon char={icon} color={color} size={28} radius={8} />
              <Text style={s.sectionTitle}>{label}</Text>
            </View>
            {byType(key).map(g => <GoalCard key={g.id} goal={g} />)}
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════
  // MORE TAB
  // ════════════════════════════════════════════════════
  const renderMore = () => {
    if (moreSection === 'goals') return renderGoalsSection();
    if (moreSection === 'groups') return renderGroupsSection();
    if (moreSection === 'budget') return renderBudgetSection();
    if (moreSection === 'networth') return renderNetWorth();
    if (moreSection === 'creditscore') return renderCreditScore();

    const items = [
      { id: 'goals', label: 'Goals', icon: '★', color: C.accent, desc: 'Track savings, debt payoff & streaks' },
      { id: 'groups', label: 'Groups', icon: '◈', color: C.blue, desc: 'Shared budgets & group goals' },
      { id: 'budget', label: 'Budget', icon: '◎', color: C.green, desc: 'Spending limits by category' },
      { id: 'networth', label: 'Net Worth', icon: '▲', color: C.amber, desc: 'Assets minus liabilities' },
      { id: 'creditscore', label: 'Credit Score', icon: 'C', color: '#06b6d4', desc: 'Monitor your credit health' },
    ];
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 20, marginTop: 4 }}>More</Text>
        {items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[s.txItem, { paddingVertical: 18 }]}
            onPress={() => { if (item.id === 'groups') { fetchGroups(); } setMoreSection(item.id); }}
            activeOpacity={0.75}
          >
            <Icon char={item.icon} color={item.color} size={46} radius={14} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 3 }}>{item.label}</Text>
              <Text style={{ color: C.textSub, fontSize: 12 }}>{item.desc}</Text>
            </View>
            <Text style={{ color: C.textMuted, fontSize: 22 }}>›</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  const renderGoalsSection = () => {
    const GOAL_TYPES = [
      { key: 'debt_payoff', label: 'Debt Payoff', icon: '⬇', color: C.red, desc: 'Pay off debts strategically' },
      { key: 'savings', label: 'Savings', icon: '★', color: C.green, desc: 'Build toward a savings target' },
      { key: 'spending_behavior', label: 'Spending Behavior', icon: '◎', color: C.amber, desc: 'Control category spending' },
      { key: 'streak', label: 'Budget Streak', icon: '🔥', color: C.accent, desc: 'Stay under budget daily' },
    ];
    const byType = (type) => goals.filter(g => g.type === type);
    const GoalCard = ({ goal }) => {
      const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
      const typeInfo = GOAL_TYPES.find(t => t.key === goal.type) || { color: C.accent, icon: '★' };
      return (
        <View style={{ backgroundColor: C.surface, borderRadius: 18, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <View style={{ height: 4, backgroundColor: typeInfo.color }} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${typeInfo.color}22`, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 17 }}>{typeInfo.icon}</Text>
                </View>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{goal.title}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {goal.update_mode === 'auto' && (
                  <View style={{ backgroundColor: C.accent + '33', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700' }}>AUTO</Text>
                  </View>
                )}
                {goal.is_completed && (
                  <View style={{ backgroundColor: C.green + '33', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: C.green, fontSize: 10, fontWeight: '700' }}>✓ DONE</Text>
                  </View>
                )}
              </View>
            </View>
            {goal.target_amount > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: C.textSub, fontSize: 13 }}>${fmtMoney(goal.current_amount)} <Text style={{ color: C.textMuted }}>of ${fmtMoney(goal.target_amount)}</Text></Text>
                  <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '800' }}>{pct}%</Text>
                </View>
                <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 4, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: typeInfo.color, borderRadius: 4 }} />
                </View>
                <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>${fmtMoney(goal.target_amount - goal.current_amount)} remaining</Text>
              </>
            )}
            {goal.type === 'streak' && (
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800' }}>{goal.streak_count || 0}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>CURRENT</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: C.textSub, fontSize: 22, fontWeight: '700' }}>{goal.streak_best || 0}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>BEST</Text>
                </View>
              </View>
            )}
            {goal.deadline && (
              <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 12 }}>Target date: {fmtDate(goal.deadline)}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: typeInfo.color + '22', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}
                onPress={async () => {
                  const newAmt = goal.current_amount + 1;
                  await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_amount: newAmt, is_completed: newAmt >= goal.target_amount }) });
                  fetchGoals();
                }}
              >
                <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '700' }}>+ Update Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: C.red + '22', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center' }}
                onPress={async () => { await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'DELETE' }); fetchGoals(); }}
              >
                <Text style={{ color: C.red, fontSize: 13, fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    };
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4, gap: 10 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', flex: 1 }}>My Goals</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setNewGoal({}); setAddGoalType('savings'); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
            <Text style={s.syncText}>+ New Goal</Text>
          </TouchableOpacity>
        </View>
        {goalsLoading && <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />}
        {!goalsLoading && goals.length === 0 && (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="★" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No goals yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set debt payoff, savings, spending, or streak goals to stay on track.</Text>
            <TouchableOpacity style={s.btn} onPress={() => { setNewGoal({}); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
              <Text style={s.btnText}>Create First Goal</Text>
            </TouchableOpacity>
          </View>
        )}
        {GOAL_TYPES.map(({ key, label, icon, color }) => byType(key).length > 0 && (
          <View key={key} style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <Icon char={icon} color={color} size={28} radius={8} />
              <Text style={s.sectionTitle}>{label}</Text>
            </View>
            {byType(key).map(g => <GoalCard key={g.id} goal={g} />)}
          </View>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  const renderBudgetSection = () => {
    const getBudgetSpend2 = (budget) => {
      const start = getPeriodStart(budget.period || 'monthly', budget.paycycle_start, budget.paycycle_freq);
      return transactions
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === budget.category)
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    };
    const totalBudgeted = budgets.reduce((s, b) => s + parseFloat(b.monthly_limit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + getBudgetSpend2(b), 0);

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 4, gap: 10 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', flex: 1 }}>Budget</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setNewBudgetPeriod('monthly'); setAddBudgetVisible(true); }}>
            <Text style={s.syncText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {budgets.length > 0 && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Total Budgeted</Text>
              <Text style={s.statVal}>${fmtMoney(totalBudgeted)}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Spent This Period</Text>
              <Text style={[s.statVal, { color: totalSpent > totalBudgeted ? C.red : C.green }]}>${fmtMoney(totalSpent)}</Text>
            </View>
          </View>
        )}
        {budgets.length === 0 ? (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="$" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No budgets yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set spending limits by category to track where your money goes.</Text>
            <TouchableOpacity style={s.btn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setAddBudgetVisible(true); }}>
              <Text style={s.btnText}>Create First Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => {
            const spent = getBudgetSpend2(b);
            const limit = parseFloat(b.monthly_limit || 0);
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const barColor = pct >= 100 ? C.red : pct >= 75 ? C.amber : C.green;
            const remaining = Math.max(0, limit - spent);
            const catInfo = PLAID_CATEGORIES.find(c => c.key === b.category);
            const catLabel = catInfo?.label || b.category;
            const catIcon = catInfo?.icon || b.category[0];
            const catBg = CAT_BG[b.category] || C.accent;
            const periodLabel2 = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', paycycle: 'Paycycle' }[b.period || 'monthly'];
            return (
              <View key={b.id} style={{ backgroundColor: C.surface, borderRadius: 18, marginBottom: 14, padding: 16, borderWidth: 1, borderColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Icon char={catIcon} color={catBg} size={44} radius={13} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{catLabel}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{periodLabel2} · ${fmtMoney(limit)} limit</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <TouchableOpacity onPress={() => { setEditingBudget(b); setNewBudgetCat(b.category); setNewBudgetLimit(String(b.monthly_limit)); setNewBudgetPeriod(b.period || 'monthly'); setNewBudgetPaycycleStart(b.paycycle_start || ''); setNewBudgetPaycycleFreq(b.paycycle_freq || 'biweekly'); setAddBudgetVisible(true); }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { await fetch(`${API_URL}/api/budgets/${b.id}`, { method: 'DELETE' }); fetchBudgets(); }}>
                      <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: barColor, borderRadius: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 1 }}>SPENT</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>${fmtMoney(spent)}</Text>
                  </View>
                  <Text style={{ color: barColor, fontSize: 20, fontWeight: '800' }}>{pct}%</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 1 }}>{pct >= 100 ? 'OVER BY' : 'REMAINING'}</Text>
                    <Text style={{ color: barColor, fontSize: 16, fontWeight: '800' }}>${fmtMoney(pct >= 100 ? spent - limit : remaining)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  const renderNetWorth = () => {
    const totalAssets = accounts.reduce((s, a) => {
      const t = (a.type || '').toLowerCase();
      if (t === 'depository' || t === 'investment') return s + (a.balances?.current || 0);
      return s;
    }, 0);
    const totalLiabilities = accounts.reduce((s, a) => {
      const t = (a.type || '').toLowerCase();
      if (t === 'credit' || t === 'loan') return s + Math.abs(a.balances?.current || 0);
      return s;
    }, 0);
    const netWorth = totalAssets - totalLiabilities;
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4, gap: 10 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>Net Worth</Text>
        </View>
        <View style={[s.balanceCard, { backgroundColor: netWorth >= 0 ? C.green : C.red }]}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 }}>Net Worth</Text>
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', marginBottom: 8 }}>${fmtMoney(Math.abs(netWorth))}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{netWorth >= 0 ? 'Positive net worth' : 'Negative net worth'}</Text>
        </View>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Assets</Text>
            <Text style={[s.statVal, { color: C.green }]}>${fmtMoney(totalAssets)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Liabilities</Text>
            <Text style={[s.statVal, { color: C.red }]}>${fmtMoney(totalLiabilities)}</Text>
          </View>
        </View>
        {accounts.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Accounts</Text>
            {accounts.map(acc => {
              const isLiability = ['credit','loan'].includes((acc.type || '').toLowerCase());
              return (
                <View key={acc.account_id} style={[s.txItem, { flexDirection: 'row' }]}>
                  <Icon char={acc.type?.[0]?.toUpperCase() || 'A'} color={isLiability ? C.red : C.green} size={42} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant}>{acc.name}</Text>
                    <Text style={s.txMeta}>{acc.subtype} · {acc.type}</Text>
                  </View>
                  <Text style={{ color: isLiability ? C.red : C.green, fontSize: 15, fontWeight: '700' }}>
                    {isLiability ? '-' : ''}${fmtMoney(acc.balances?.current || 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={s.emptyTitle}>No accounts linked</Text>
            <Text style={s.emptyText}>Connect your bank to see your net worth breakdown.</Text>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  const renderCreditScore = () => (
    <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4, gap: 10 }}>
        <TouchableOpacity onPress={() => setMoreSection(null)}>
          <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ More</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>Credit Score</Text>
      </View>
      <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 48 }]}>
        <Icon char="C" color="#06b6d4" size={64} radius={20} />
        <Text style={[s.emptyTitle, { marginTop: 20 }]}>Coming Soon</Text>
        <Text style={[s.emptyText, { marginBottom: 8 }]}>Credit score monitoring will be available in a future update. We'll notify you when it's ready.</Text>
        <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center' }}>WealthPal AI · Powered by secure credit bureau data</Text>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderGroupsSection = () => (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {!currentGroup ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8, gap: 10 }}>
            <TouchableOpacity onPress={() => setMoreSection(null)}>
              <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ More</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', flex: 1 }}>Groups</Text>
            <TouchableOpacity style={s.syncBtn} onPress={() => setCreateGroupVisible(true)}>
              <Text style={s.syncText}>+ Create</Text>
            </TouchableOpacity>
          </View>
          {groups.length === 0 && (
            <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 32 }]}>
              <Icon char="◈" color={C.accent} size={52} radius={16} />
              <Text style={[s.emptyTitle, { marginTop: 16 }]}>No groups yet</Text>
              <Text style={s.emptyText}>Create a group to share goals and financial insights with friends or family.</Text>
            </View>
          )}
          {groups.map(g => (
            <TouchableOpacity key={g.id} style={s.txItem} onPress={() => { setCurrentGroup(g); fetchGroupDetail(g.id); }} activeOpacity={0.75}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{g.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txMerchant}>{g.name}</Text>
                <Text style={s.txMeta}>{g.role === 'admin' ? 'Admin' : 'Member'} · {(groupDetail?.members?.length || 0)} members</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8, gap: 10 }}>
            <TouchableOpacity onPress={() => { setCurrentGroup(null); setGroupSharedTx([]); }}>
              <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ Groups</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{currentGroup.name}</Text>
          </View>

          {/* ── Group Feed ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Group Feed</Text>
            {groupSharedTx.length === 0 ? (
              <View style={[s.connectCard, { paddingVertical: 20, alignItems: 'center' }]}>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center' }}>
                  No shared activity yet. Members can share their transactions below.
                </Text>
              </View>
            ) : (
              groupSharedTx.slice(0, 15).map((tx, i) => (
                <View key={i} style={[s.txItem, { paddingVertical: 12 }]}>
                  <CatIcon category={tx.category} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant} numberOfLines={1}>{tx.merchant_name || 'Unknown'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.blue, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{(tx.member_email?.[0] || '?').toUpperCase()}</Text>
                      </View>
                      <Text style={s.txMeta}>{tx.member_email?.split('@')[0]} · {fmtDate(tx.transaction_date)}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.txAmt}>-${fmtMoney(tx.amount)}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 1 }}>{(tx.category || 'Other').replace(/_/g, ' ')}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── Member Balances (if shared) ── */}
          {groupDetail.members.some(m => m.share_accounts) && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Member Balances</Text>
              {groupDetail.members.filter(m => m.share_accounts).map(m => (
                <View key={m.id} style={[s.txItem]}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.blue, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(m.email?.[0] || '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant}>{m.email?.split('@')[0]}</Text>
                    <Text style={s.txMeta}>Sharing balances</Text>
                  </View>
                  <Text style={{ color: C.green, fontSize: 14, fontWeight: '700' }}>Visible</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── My Sharing Settings ── */}
          {groupDetail.members.filter(m => m.email === email).map(m => (
            <View key={m.id} style={s.section}>
              <Text style={s.sectionTitle}>My Sharing</Text>
              <View style={[s.insightCard, { flexDirection: 'column', gap: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>Share Transactions</Text>
                    <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Show the group your transactions</Text>
                  </View>
                  {groupShareLoading ? <ActivityIndicator size="small" color={C.accent} /> : (
                    <Switch
                      value={!!m.share_transactions}
                      onValueChange={async (v) => {
                        setGroupShareLoading(true);
                        await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ share_transactions: v, share_accounts: !!m.share_accounts }),
                        });
                        await fetchGroupDetail(currentGroup.id);
                        setGroupShareLoading(false);
                      }}
                      trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff"
                    />
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>Share Account Balances</Text>
                    <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Show the group your balances</Text>
                  </View>
                  {groupShareLoading ? <ActivityIndicator size="small" color={C.accent} /> : (
                    <Switch
                      value={!!m.share_accounts}
                      onValueChange={async (v) => {
                        setGroupShareLoading(true);
                        await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ share_transactions: !!m.share_transactions, share_accounts: v }),
                        });
                        await fetchGroupDetail(currentGroup.id);
                        setGroupShareLoading(false);
                      }}
                      trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff"
                    />
                  )}
                </View>
              </View>
            </View>
          ))}

          {/* ── Members ── */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Members ({groupDetail.members.length})</Text>
            {groupDetail.members.map(m => (
              <View key={m.id} style={[s.txItem, { paddingVertical: 12 }]}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: m.email === email ? C.accent : C.surface2, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: m.email === email ? '#fff' : C.textSub, fontSize: 16, fontWeight: '700' }}>{(m.email?.[0] || '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txMerchant}>{m.email === email ? 'You' : m.email?.split('@')[0]}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                    <Text style={{ color: C.textMuted, fontSize: 11, backgroundColor: C.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{m.role}</Text>
                    {m.share_transactions && <Text style={{ color: C.green, fontSize: 11, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>Txns</Text>}
                    {m.share_accounts && <Text style={{ color: C.blue, fontSize: 11, backgroundColor: 'rgba(59,130,246,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>Balance</Text>}
                  </View>
                </View>
                {m.email !== email && (
                  <TouchableOpacity onPress={async () => {
                    await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, { method: 'DELETE' });
                    fetchGroupDetail(currentGroup.id);
                  }}>
                    <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Invite by email…"
                placeholderTextColor={C.textMuted}
                value={addMemberEmail}
                onChangeText={setAddMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={{ backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' }}
                onPress={async () => {
                  if (!addMemberEmail.trim()) return;
                  await fetch(`${API_URL}/api/groups/${currentGroup.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: addMemberEmail.trim() }) });
                  setAddMemberEmail('');
                  fetchGroupDetail(currentGroup.id);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Group Goals ── */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Group Goals</Text>
              <TouchableOpacity style={s.syncBtn} onPress={() => { setNewGroupGoal({}); setAddGroupGoalVisible(true); }}>
                <Text style={s.syncText}>+ Goal</Text>
              </TouchableOpacity>
            </View>
            {groupDetail.goals.length === 0 && <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 8 }}>No group goals yet.</Text>}
            {groupDetail.goals.map(g => {
              const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
              return (
                <View key={g.id} style={[s.insightCard, { flexDirection: 'column', gap: 8 }]}>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{g.title}</Text>
                  {g.target_amount > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: C.textSub, fontSize: 12 }}>${fmtMoney(g.current_amount)} / ${fmtMoney(g.target_amount)}</Text>
                        <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
                      </View>
                      <View style={s.barBg}><View style={[s.bar, { width: `${pct}%`, backgroundColor: C.accent }]} /></View>
                    </>
                  )}
                  {g.deadline && <Text style={{ color: C.textMuted, fontSize: 11 }}>By {fmtDate(g.deadline)}</Text>}
                </View>
              );
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );

  // ════════════════════════════════════════════════════
  // GROUPS SCREEN
  // ════════════════════════════════════════════════════
  const renderGroupsScreen = () => (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { backgroundColor: C.surface }]}>
        <View>
          <Text style={s.headerGreet}>Group Mode</Text>
          <Text style={s.headerName}>{currentGroup ? currentGroup.name : 'My Groups'}</Text>
        </View>
        <TouchableOpacity onPress={() => setGroupMode(false)} style={{ backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>✕ Exit</Text>
        </TouchableOpacity>
      </View>
      {!currentGroup ? (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <TouchableOpacity style={[s.btn, { marginBottom: 20 }]} onPress={() => setCreateGroupVisible(true)}>
            <Text style={s.btnText}>+ Create New Group</Text>
          </TouchableOpacity>
          {groups.length === 0 && (
            <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 32 }]}>
              <Icon char="◈" color={C.accent} size={52} radius={16} />
              <Text style={[s.emptyTitle, { marginTop: 16 }]}>No groups yet</Text>
              <Text style={s.emptyText}>Create a group to share goals and financial insights with friends or family.</Text>
            </View>
          )}
          {groups.map(g => (
            <TouchableOpacity key={g.id} style={s.txItem} onPress={() => { setCurrentGroup(g); fetchGroupDetail(g.id); }}>
              <Icon char={g.name[0].toUpperCase()} color={C.accent} size={42} radius={12} />
              <View style={{ flex: 1 }}>
                <Text style={s.txMerchant}>{g.name}</Text>
                <Text style={s.txMeta}>{g.role === 'admin' ? 'Admin' : 'Member'}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <TouchableOpacity onPress={() => { setCurrentGroup(null); setGroupSharedTx([]); }} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ All Groups</Text>
          </TouchableOpacity>

          {/* Group Hub — Shared Feed */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Group Feed</Text>
            {groupSharedTx.length === 0 ? (
              <View style={[s.connectCard, { paddingVertical: 24, alignItems: 'center' }]}>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center' }}>
                  No shared transactions yet. Members can share their transactions using the toggles below.
                </Text>
              </View>
            ) : (
              groupSharedTx.slice(0, 10).map((tx, i) => (
                <View key={i} style={s.txItem}>
                  <CatIcon category={tx.category} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant} numberOfLines={1}>{tx.merchant_name || 'Unknown'}</Text>
                    <Text style={s.txMeta}>{fmtDate(tx.transaction_date)} · {tx.member_email?.split('@')[0]}</Text>
                  </View>
                  <Text style={s.txAmt}>-${fmtMoney(tx.amount)}</Text>
                </View>
              ))
            )}
          </View>

          {/* My Sharing Settings — only for current user's own row */}
          {groupDetail.members.filter(m => m.email === email).map(m => (
            <View key={m.id} style={[s.section]}>
              <Text style={s.sectionTitle}>My Sharing Settings</Text>
              <View style={[s.txItem, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Share Transactions</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>Show the group your transactions</Text>
                  </View>
                  <Switch
                    value={!!m.share_transactions}
                    onValueChange={async (v) => {
                      await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ share_transactions: v, share_accounts: !!m.share_accounts }),
                      });
                      fetchGroupDetail(currentGroup.id);
                    }}
                    trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff"
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Share Account Balances</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>Show the group your balances</Text>
                  </View>
                  <Switch
                    value={!!m.share_accounts}
                    onValueChange={async (v) => {
                      await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ share_transactions: !!m.share_transactions, share_accounts: v }),
                      });
                      fetchGroupDetail(currentGroup.id);
                    }}
                    trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff"
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Members */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Members</Text>
              <TouchableOpacity style={s.syncBtn} onPress={() => setAddMemberEmail('')}>
                <Text style={s.syncText}>+ Invite</Text>
              </TouchableOpacity>
            </View>
            {groupDetail.members.map(m => (
              <View key={m.id} style={s.txItem}>
                <Icon char={(m.email?.[0] || '?').toUpperCase()} color={C.blue} size={42} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txMerchant} numberOfLines={1}>{m.email}</Text>
                  <Text style={s.txMeta}>{m.role} · {m.share_transactions ? 'Sharing txns' : ''}{m.share_accounts ? ' · Sharing accts' : ''}</Text>
                </View>
                {m.email !== email && (
                  <TouchableOpacity onPress={async () => {
                    await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, { method: 'DELETE' });
                    fetchGroupDetail(currentGroup.id);
                  }}>
                    <Text style={{ color: C.red, fontSize: 11, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {/* Invite row */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Email to invite…"
                placeholderTextColor={C.textMuted}
                value={addMemberEmail}
                onChangeText={setAddMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={{ backgroundColor: C.accent, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' }}
                onPress={async () => {
                  if (!addMemberEmail.trim()) return;
                  await fetch(`${API_URL}/api/groups/${currentGroup.id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: addMemberEmail.trim() }) });
                  setAddMemberEmail('');
                  fetchGroupDetail(currentGroup.id);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Group Goals */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Group Goals</Text>
              <TouchableOpacity style={s.syncBtn} onPress={() => { setNewGroupGoal({}); setAddGroupGoalVisible(true); }}>
                <Text style={s.syncText}>+ Goal</Text>
              </TouchableOpacity>
            </View>
            {groupDetail.goals.length === 0 && <Text style={{ color: C.textSub, fontSize: 13 }}>No group goals yet.</Text>}
            {groupDetail.goals.map(g => {
              const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
              return (
                <View key={g.id} style={[s.insightCard, { flexDirection: 'column', gap: 8 }]}>
                  <Text style={{ color: C.text, fontWeight: '600' }}>{g.title}</Text>
                  {g.target_amount > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: C.textSub, fontSize: 12 }}>${fmtMoney(g.current_amount)} / ${fmtMoney(g.target_amount)}</Text>
                        <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
                      </View>
                      <View style={s.barBg}><View style={[s.bar, { width: `${pct}%`, backgroundColor: C.accent }]} /></View>
                    </>
                  )}
                  {g.deadline && <Text style={{ color: C.textMuted, fontSize: 11 }}>By {fmtDate(g.deadline)}</Text>}
                </View>
              );
            })}
          </View>
          {/* Privacy */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>My Privacy Settings</Text>
            <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20 }}>
              Control what group members can see. Toggle sharing per-member using the member list above. Your personal data is only shared when you explicitly allow it.
            </Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );

  // ════════════════════════════════════════════════════
  // BUDGET TAB
  // ════════════════════════════════════════════════════
  const renderBudget = () => {
    const getBudgetSpend = (budget) => {
      const start = getPeriodStart(budget.period || 'monthly', budget.paycycle_start, budget.paycycle_freq);
      return transactions
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === budget.category)
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    };
    const totalBudgeted = budgets.reduce((s, b) => s + parseFloat(b.monthly_limit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + getBudgetSpend(b), 0);

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>Budget</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setAddBudgetVisible(true); }}>
            <Text style={s.syncText}>+ Add Budget</Text>
          </TouchableOpacity>
        </View>

        {budgets.length > 0 && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Total Budgeted</Text>
              <Text style={s.statVal}>${fmtMoney(totalBudgeted)}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Spent This Month</Text>
              <Text style={[s.statVal, { color: totalSpent > totalBudgeted ? C.red : C.green }]}>${fmtMoney(totalSpent)}</Text>
            </View>
          </View>
        )}

        {budgets.length === 0 ? (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="$" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No budgets yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set spending limits by category to track where your money goes.</Text>
            <TouchableOpacity style={s.btn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setAddBudgetVisible(true); }}>
              <Text style={s.btnText}>Create First Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => {
            const spent = getBudgetSpend(b);
            const limit = parseFloat(b.monthly_limit || 0);
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const barColor = pct >= 100 ? C.red : pct >= 75 ? C.amber : C.green;
            const remaining = Math.max(0, limit - spent);
            const catInfo = PLAID_CATEGORIES.find(c => c.key === b.category);
            const catLabel = catInfo?.label || b.category;
            const catIcon = catInfo?.icon || b.category[0];
            const catBg = CAT_BG[b.category] || C.accent;
            const periodLabel = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', paycycle: 'Paycycle' }[b.period || 'monthly'];
            return (
              <View key={b.id} style={{ backgroundColor: C.surface, borderRadius: 18, marginBottom: 14, padding: 16, borderWidth: 1, borderColor: C.border }}>
                {/* Header row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Icon char={catIcon} color={catBg} size={44} radius={13} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{catLabel}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{periodLabel} · ${fmtMoney(limit)} limit</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <TouchableOpacity onPress={() => { setEditingBudget(b); setNewBudgetCat(b.category); setNewBudgetLimit(String(b.monthly_limit)); setNewBudgetPeriod(b.period || 'monthly'); setAddBudgetVisible(true); }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { await fetch(`${API_URL}/api/budgets/${b.id}`, { method: 'DELETE' }); fetchBudgets(); }}>
                      <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${pct}%`, backgroundColor: barColor, borderRadius: 4 }} />
                </View>
                {/* Spend/remaining row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 1 }}>SPENT</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>${fmtMoney(spent)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: barColor, fontSize: 20, fontWeight: '800' }}>{pct}%</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 1 }}>{pct >= 100 ? 'OVER BY' : 'REMAINING'}</Text>
                    <Text style={{ color: barColor, fontSize: 16, fontWeight: '800' }}>${fmtMoney(pct >= 100 ? spent - limit : remaining)}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // CHAT TAB
  // ════════════════════════════════════════════════════
  const renderChat = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={chatMessages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === 'user' ? s.userBubble : s.aiBubble]}>
            {item.role === 'assistant' && <Text style={s.bubbleName}>WealthPal AI</Text>}
            <Text style={[s.bubbleText, item.role === 'user' && { color: '#fff' }]}>{item.text}</Text>
          </View>
        )}
      />
      {loadingChat && (
        <View style={[s.aiBubble, s.bubble, { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={{ color: C.textSub, fontSize: 13 }}>WealthPal AI is thinking…</Text>
        </View>
      )}
      <View style={s.chatBar}>
        <TextInput
          style={s.chatInput}
          placeholder="Ask about your finances..."
          placeholderTextColor={C.textMuted}
          value={chatInput}
          onChangeText={setChatInput}
          editable={!loadingChat}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!chatInput.trim() || loadingChat) && s.sendBtnOff]}
          onPress={sendChat}
          disabled={loadingChat || !chatInput.trim()}
        >
          {loadingChat
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.sendBtnText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ════════════════════════════════════════════════════
  // DRAWER
  // ════════════════════════════════════════════════════
  const renderDrawer = () => (
    <>
      <Animated.View style={[s.overlay, { opacity: overlayO }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDrawer} />
      </Animated.View>
      <Animated.View style={[s.drawer, { transform: [{ translateX: drawerX }] }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* User */}
          <View style={s.drawerUser}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{(displayName?.[0] || 'W').toUpperCase()}</Text>
            </View>
            <Text style={s.drawerName}>{displayName || 'User'}</Text>
            <Text style={s.drawerEmail}>{email}</Text>
          </View>

          {/* Banking */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Banking</Text>
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(openPlaidLink, 300); }}
            >
              <Icon char="B" color={C.blue} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Connect Bank</Text>
                <Text style={s.drawerRowSub}>
                  {linkedAccount ? 'Connected · tap to reconnect' : 'Not connected'}
                </Text>
              </View>
              <View style={[s.statusDot, { backgroundColor: linkedAccount ? C.green : C.textMuted }]} />
            </TouchableOpacity>
            {linkedAccount && (
              <TouchableOpacity
                style={s.drawerRow}
                onPress={() => { closeDrawer(); setTimeout(syncTransactions, 300); }}
              >
                <Icon char="↻" color={C.accent} size={32} />
                <Text style={[s.drawerRowText, { marginLeft: 12 }]}>Sync Transactions</Text>
              </TouchableOpacity>
            )}
            {!!plaidError && (
              <Text style={[s.drawerRowSub, { color: C.red, paddingHorizontal: 0, paddingBottom: 8 }]}>{plaidError}</Text>
            )}
            {!!plaidStatus && (
              <Text style={[s.drawerRowSub, { color: C.green, paddingBottom: 8 }]}>{plaidStatus}</Text>
            )}
          </View>

          {/* Notifications */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Notifications</Text>
            <View style={s.drawerRow}>
              <Icon char="N" color={C.amber} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>All Notifications</Text>
                <Text style={s.drawerRowSub}>Master toggle for push alerts</Text>
              </View>
              <Switch value={notifOverall} onValueChange={toggleNotifOverall} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
            </View>
            {notifOverall && (
              <>
                <View style={[s.drawerRow, { paddingLeft: 12 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.red, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drawerRowText}>Budget Alerts</Text>
                    <Text style={s.drawerRowSub}>Notify when 90%+ of budget used</Text>
                  </View>
                  <Switch value={notifBudget} onValueChange={toggleNotifBudget} trackColor={{ false: C.border, true: C.red }} thumbColor="#fff" />
                </View>
                <View style={[s.drawerRow, { paddingLeft: 12 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drawerRowText}>Daily Newsletter</Text>
                    <Text style={s.drawerRowSub}>AI spending summary every morning</Text>
                  </View>
                  <Switch value={notifDaily} onValueChange={v => toggleNotifPeriod('daily', v)} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
                </View>
                <View style={[s.drawerRow, { paddingLeft: 12 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drawerRowText}>Weekly Newsletter</Text>
                    <Text style={s.drawerRowSub}>Monday morning weekly recap</Text>
                  </View>
                  <Switch value={notifWeekly} onValueChange={v => toggleNotifPeriod('weekly', v)} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
                </View>
                <View style={[s.drawerRow, { paddingLeft: 12 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.drawerRowText}>Monthly Newsletter</Text>
                    <Text style={s.drawerRowSub}>Full month summary on the 1st</Text>
                  </View>
                  <Switch value={notifMonthly} onValueChange={v => toggleNotifPeriod('monthly', v)} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
                </View>
              </>
            )}
          </View>

          {/* Settings */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Settings</Text>
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(openEditProfile, 300); }}
            >
              <Icon char="✎" color={C.accent} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Edit Profile</Text>
                <Text style={s.drawerRowSub}>Change your name and account info</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <View style={s.drawerRow}>
              <Icon char="ID" color={C.green} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Face ID / Biometrics</Text>
              <Switch value={biometrics} onValueChange={setBiometrics} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
            </View>
            <View style={s.drawerRow}>
              <Icon char="◱" color={C.blue} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Android Home Widget</Text>
                <Text style={s.drawerRowSub}>AI bubble on your home screen</Text>
              </View>
              <Switch
                value={widgetEnabled}
                onValueChange={v => { if (v) setWidgetInfoVisible(true); else setWidgetEnabled(false); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="P" color={C.textSub} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Privacy & Security</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="$" color={C.green} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Currency</Text>
                <Text style={s.drawerRowSub}>USD · US Dollar</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Customize */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Customize</Text>
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(() => setCustomizeVisible(true), 300); }}
            >
              <Icon char="◐" color={C.accent} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Theme & Colors</Text>
                <Text style={s.drawerRowSub}>Background, accent color</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, marginRight: 8 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: themeBg, borderWidth: 1, borderColor: C.border }} />
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: themeAccent }} />
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Support */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Support</Text>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="?" color={C.blue} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Help & FAQ</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="★" color={C.amber} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Rate WealthPal AI</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="i" color={C.textSub} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>About</Text>
                <Text style={s.drawerRowSub}>Version 1.0.0</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </>
  );

  // ════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.appWrap}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <View>
          <Text style={s.headerGreet}>Welcome back,</Text>
          <Text style={s.headerName}>{displayName || 'User'}</Text>
        </View>
        <TouchableOpacity style={s.menuBtn} onPress={openDrawer}>
          <Text style={{ fontSize: 26, color: C.textSub }}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'chat' && renderChat()}
        {activeTab === 'more' && renderMore()}
      </View>

      <View style={s.bottomNav}>
        {[
          { id: 'dashboard', label: 'Home', icon: '⌂' },
          { id: 'insights', label: 'Insights', icon: '◈' },
          { id: 'transactions', label: 'Txns', icon: '≡' },
          { id: 'chat', label: 'AI', icon: '✦' },
          { id: 'more', label: 'More', icon: '☰' },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={s.navTab} onPress={() => { if (tab.id !== 'more') setMoreSection(null); setActiveTab(tab.id); }}>
            <Text style={[s.navIcon, activeTab === tab.id && s.navIconOn]}>{tab.icon}</Text>
            <Text style={[s.navLabel, activeTab === tab.id && s.navLabelOn]}>{tab.label}</Text>
            {activeTab === tab.id && <View style={s.navDot} />}
          </TouchableOpacity>
        ))}
      </View>

      {drawerOpen && renderDrawer()}

      {/* Customize Modal */}
      <Modal visible={customizeVisible} animationType="slide" transparent onRequestClose={() => setCustomizeVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Theme & Colors</Text>

            <Text style={[s.label, { marginBottom: 12 }]}>Primary (Background)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {BG_OPTIONS.map(({ hex, label }) => (
                <TouchableOpacity
                  key={hex}
                  onPress={() => changeBg(hex)}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 22, backgroundColor: hex,
                    borderWidth: themeBg === hex ? 3 : 1.5,
                    borderColor: themeBg === hex ? C.accent : C.border,
                  }} />
                  <Text style={{ color: C.textMuted, fontSize: 10 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { marginBottom: 12 }]}>Secondary (Accent)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
              {ACCENT_OPTIONS.map(color => (
                <View
                  key={color}
                  style={{
                    width: 44, height: 44, borderRadius: 22, backgroundColor: color,
                    borderWidth: themeAccent === color ? 3 : 1.5,
                    borderColor: themeAccent === color ? '#fff' : 'transparent',
                    overflow: 'hidden',
                  }}
                >
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => changeAccent(color)} />
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.btn} onPress={() => setCustomizeVisible(false)}>
              <Text style={s.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Widget Info Modal */}
      <Modal visible={widgetInfoVisible} animationType="slide" transparent onRequestClose={() => setWidgetInfoVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Android Home Widget</Text>
            <View style={{ backgroundColor: C.bg, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>◱  WealthPal AI Bubble</Text>
              <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20 }}>
                A floating AI chat bubble on your Android home screen with quick access to your account balance, recent transactions, and spending insights — powered by the same AI as the app.
              </Text>
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20, marginBottom: 24 }}>
              This feature is available in the next app update. To get it, download the latest version of WealthPal AI from the Play Store once the update is live.
            </Text>
            <TouchableOpacity style={s.btn} onPress={() => { setWidgetInfoVisible(false); setWidgetEnabled(false); }}>
              <Text style={s.btnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editProfileVisible} animationType="slide" transparent onRequestClose={() => setEditProfileVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            {!!profileError && <View style={s.errBox}><Text style={s.errText}>{profileError}</Text></View>}
            <Text style={s.label}>First Name</Text>
            <TextInput
              style={s.input}
              placeholder="First name"
              placeholderTextColor={C.textMuted}
              value={editFirst}
              onChangeText={setEditFirst}
              editable={!savingProfile}
            />
            <Text style={s.label}>Last Name</Text>
            <TextInput
              style={s.input}
              placeholder="Last name"
              placeholderTextColor={C.textMuted}
              value={editLast}
              onChangeText={setEditLast}
              editable={!savingProfile}
            />
            <TouchableOpacity style={[s.btn, savingProfile && s.btnOff]} onPress={saveProfile} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.linkRow} onPress={() => setEditProfileVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Transaction Edit Modal */}
      <Modal visible={editTxVisible} animationType="slide" transparent onRequestClose={() => setEditTxVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Transaction</Text>
            <Text style={s.label}>Merchant / Name</Text>
            <TextInput style={s.input} value={editTxFields.merchant_name} onChangeText={v => setEditTxFields(p => ({...p, merchant_name: v}))} placeholderTextColor={C.textMuted} />
            <Text style={s.label}>Amount ($)</Text>
            <TextInput style={s.input} value={editTxFields.amount} onChangeText={v => setEditTxFields(p => ({...p, amount: v}))} keyboardType="decimal-pad" placeholderTextColor={C.textMuted} />
            <Text style={s.label}>Category</Text>
            <TextInput style={s.input} value={editTxFields.category} onChangeText={v => setEditTxFields(p => ({...p, category: v}))} placeholderTextColor={C.textMuted} />
            <Text style={s.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={editTxFields.transaction_date} onChangeText={v => setEditTxFields(p => ({...p, transaction_date: v}))} placeholderTextColor={C.textMuted} />
            <Text style={s.label}>Description</Text>
            <TextInput style={s.input} value={editTxFields.description} onChangeText={v => setEditTxFields(p => ({...p, description: v}))} placeholderTextColor={C.textMuted} />
            <TouchableOpacity
              style={[s.btn, savingTx && s.btnOff]}
              disabled={savingTx}
              onPress={async () => {
                setSavingTx(true);
                try {
                  await fetch(`${API_URL}/api/transactions/${editingTx.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editTxFields, amount: parseFloat(editTxFields.amount) }) });
                  setEditTxVisible(false);
                  fetchTransactions();
                } catch {}
                finally { setSavingTx(false); }
              }}
            >
              {savingTx ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.linkRow} onPress={() => setEditTxVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Goal Modal */}
      <Modal visible={addGoalVisible} animationType="slide" transparent onRequestClose={() => setAddGoalVisible(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>New Goal</Text>
              <Text style={s.label}>Goal Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                {[['savings','★ Savings'],['debt_payoff','⬇ Debt Payoff'],['spending_behavior','◎ Spending'],['streak','🔥 Streak']].map(([k, l]) => (
                  <TouchableOpacity key={k} onPress={() => setAddGoalType(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: addGoalType === k ? C.accent : C.surface, borderWidth: 1, borderColor: addGoalType === k ? C.accent : C.border }}>
                    <Text style={{ color: addGoalType === k ? '#fff' : C.textSub, fontSize: 13, fontWeight: '600' }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {(addGoalType === 'savings' || addGoalType === 'debt_payoff') && (
                <>
                  <Text style={s.label}>Update Mode</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                    {[['manual','Manual'],['auto','Automatic']].map(([k, l]) => (
                      <TouchableOpacity key={k} onPress={() => setAddGoalUpdateMode(k)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: addGoalUpdateMode === k ? C.accent : C.surface, borderWidth: 1, borderColor: addGoalUpdateMode === k ? C.accent : C.border }}>
                        <Text style={{ color: addGoalUpdateMode === k ? '#fff' : C.textSub, fontWeight: '600', fontSize: 13 }}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {addGoalUpdateMode === 'auto' && (
                    <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: C.textSub, fontSize: 12, lineHeight: 18 }}>
                        Automatic: after each sync, progress is computed from your transactions — savings/transfer transactions for savings goals, loan/payment transactions for debt payoff goals.
                      </Text>
                    </View>
                  )}
                </>
              )}
              <Text style={s.label}>Title</Text>
              <TextInput style={s.input} placeholder={addGoalType === 'debt_payoff' ? 'e.g. Pay off car loan' : addGoalType === 'savings' ? 'e.g. Emergency fund' : addGoalType === 'spending_behavior' ? 'e.g. Reduce dining out' : 'e.g. Under budget streak'} placeholderTextColor={C.textMuted} value={newGoal.title || ''} onChangeText={v => setNewGoal(p => ({...p, title: v}))} />
              {addGoalType !== 'streak' && (
                <>
                  <Text style={s.label}>Target Amount ($)</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textMuted} value={newGoal.target_amount || ''} onChangeText={v => setNewGoal(p => ({...p, target_amount: v}))} />
                  <Text style={s.label}>Current Amount ($)</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textMuted} value={newGoal.current_amount || ''} onChangeText={v => setNewGoal(p => ({...p, current_amount: v}))} />
                </>
              )}
              {addGoalType === 'spending_behavior' && (
                <>
                  <Text style={s.label}>Category</Text>
                  <TextInput style={s.input} placeholder="e.g. Food and Drink" placeholderTextColor={C.textMuted} value={newGoal.category || ''} onChangeText={v => setNewGoal(p => ({...p, category: v}))} />
                </>
              )}
              <Text style={s.label}>Target Date (optional)</Text>
              <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted} value={newGoal.deadline || ''} onChangeText={v => setNewGoal(p => ({...p, deadline: v}))} />
              <TouchableOpacity
                style={[s.btn, savingGoal && s.btnOff]}
                disabled={savingGoal || !newGoal.title?.trim()}
                onPress={async () => {
                  setSavingGoal(true);
                  try {
                    await fetch(`${API_URL}/api/goals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, type: addGoalType, update_mode: addGoalUpdateMode, ...newGoal, target_amount: parseFloat(newGoal.target_amount) || null, current_amount: parseFloat(newGoal.current_amount) || 0 }) });
                    setAddGoalVisible(false);
                    setNewGoal({});
                    fetchGoals();
                  } catch {}
                  finally { setSavingGoal(false); }
                }}
              >
                {savingGoal ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Goal</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.linkRow} onPress={() => setAddGoalVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={createGroupVisible} animationType="slide" transparent onRequestClose={() => setCreateGroupVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Create Group</Text>
            <Text style={s.label}>Group Name</Text>
            <TextInput style={s.input} placeholder="e.g. Family Budget, Roommates" placeholderTextColor={C.textMuted} value={newGroupName} onChangeText={setNewGroupName} />
            <TouchableOpacity
              style={[s.btn, !newGroupName.trim() && s.btnOff]}
              disabled={!newGroupName.trim()}
              onPress={async () => {
                try {
                  const res = await fetch(`${API_URL}/api/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGroupName.trim(), userId, email }) });
                  const d = await res.json();
                  setCreateGroupVisible(false);
                  setNewGroupName('');
                  await fetchGroups();
                  setCurrentGroup(d.group);
                  fetchGroupDetail(d.group.id);
                } catch {}
              }}
            >
              <Text style={s.btnText}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.linkRow} onPress={() => setCreateGroupVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Budget Modal */}
      <Modal visible={addBudgetVisible} animationType="slide" transparent onRequestClose={() => setAddBudgetVisible(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>{editingBudget ? 'Edit Budget' : 'New Budget'}</Text>

              {/* Category picker — only for new budgets */}
              {!editingBudget && (
                <>
                  <Text style={s.label}>Category</Text>
                  <ScrollView style={{ maxHeight: 180, marginBottom: 18 }} showsVerticalScrollIndicator={false}>
                    {PLAID_CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.key}
                        onPress={() => setNewBudgetCat(cat.key)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4, backgroundColor: newBudgetCat === cat.key ? C.accent : C.surface, borderWidth: 1, borderColor: newBudgetCat === cat.key ? C.accent : C.border }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: newBudgetCat === cat.key ? 'rgba(255,255,255,0.2)' : C.surface2, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: newBudgetCat === cat.key ? '#fff' : C.textSub, fontSize: 14, fontWeight: '700' }}>{cat.icon}</Text>
                        </View>
                        <Text style={{ color: newBudgetCat === cat.key ? '#fff' : C.text, fontSize: 14, fontWeight: '500', flex: 1 }}>{cat.label}</Text>
                        {newBudgetCat === cat.key && <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              {editingBudget && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
                  <CatIcon category={editingBudget.category} />
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{PLAID_CATEGORIES.find(c => c.key === editingBudget.category)?.label || editingBudget.category}</Text>
                </View>
              )}

              {/* Budget period */}
              <Text style={s.label}>Budget Period</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[['weekly','Weekly'],['biweekly','Biweekly'],['monthly','Monthly'],['paycycle','Paycycle']].map(([k, l]) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setNewBudgetPeriod(k)}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: newBudgetPeriod === k ? C.accent : C.surface, borderWidth: 1, borderColor: newBudgetPeriod === k ? C.accent : C.border }}
                  >
                    <Text style={{ color: newBudgetPeriod === k ? '#fff' : C.textSub, fontWeight: '600', fontSize: 12 }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {newBudgetPeriod === 'paycycle' && (
                <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                  <Text style={[s.label, { marginBottom: 8 }]}>Pay Frequency</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {[['weekly','Weekly'],['biweekly','Every 2 Wks'],['monthly','Monthly']].map(([k, l]) => (
                      <TouchableOpacity key={k} onPress={() => setNewBudgetPaycycleFreq(k)}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: newBudgetPaycycleFreq === k ? C.accent : C.surface2, borderWidth: 1, borderColor: newBudgetPaycycleFreq === k ? C.accent : C.border }}>
                        <Text style={{ color: newBudgetPaycycleFreq === k ? '#fff' : C.textSub, fontWeight: '600', fontSize: 11 }}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[s.label, { marginBottom: 8 }]}>Next Payday (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[s.input, { marginBottom: 0 }]}
                    placeholder="e.g. 2025-06-01"
                    placeholderTextColor={C.textMuted}
                    value={newBudgetPaycycleStart}
                    onChangeText={setNewBudgetPaycycleStart}
                  />
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 6 }}>Your budget resets each paycycle starting from this date.</Text>
                </View>
              )}
              <View style={{ marginBottom: 6 }} />

              {/* Limit */}
              <Text style={s.label}>Spending Limit ($)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textMuted}
                value={newBudgetLimit}
                onChangeText={setNewBudgetLimit}
              />

              <TouchableOpacity
                style={[s.btn, (savingBudget || !newBudgetCat.trim() || !newBudgetLimit) && s.btnOff]}
                disabled={savingBudget || !newBudgetCat.trim() || !newBudgetLimit}
                onPress={async () => {
                  setSavingBudget(true);
                  try {
                    const paycycleData = newBudgetPeriod === 'paycycle'
                      ? { paycycle_start: newBudgetPaycycleStart || null, paycycle_freq: newBudgetPaycycleFreq }
                      : {};
                    if (editingBudget) {
                      await fetch(`${API_URL}/api/budgets/${editingBudget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthly_limit: parseFloat(newBudgetLimit), period: newBudgetPeriod, ...paycycleData }) });
                    } else {
                      await fetch(`${API_URL}/api/budgets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, category: newBudgetCat.trim(), monthly_limit: parseFloat(newBudgetLimit), period: newBudgetPeriod, ...paycycleData }) });
                    }
                    setAddBudgetVisible(false);
                    setEditingBudget(null);
                    fetchBudgets();
                  } catch {}
                  finally { setSavingBudget(false); }
                }}
              >
                {savingBudget ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editingBudget ? 'Save Changes' : 'Create Budget'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.linkRow} onPress={() => { setAddBudgetVisible(false); setEditingBudget(null); setNewBudgetPaycycleStart(''); setNewBudgetPaycycleFreq('biweekly'); }}>
                <Text style={s.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Group Goal Modal */}
      <Modal visible={addGroupGoalVisible} animationType="slide" transparent onRequestClose={() => setAddGroupGoalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>New Group Goal</Text>
            <Text style={s.label}>Title</Text>
            <TextInput style={s.input} placeholder="e.g. Save for vacation" placeholderTextColor={C.textMuted} value={newGroupGoal.title || ''} onChangeText={v => setNewGroupGoal(p => ({...p, title: v}))} />
            <Text style={s.label}>Target Amount ($)</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textMuted} value={newGroupGoal.target_amount || ''} onChangeText={v => setNewGroupGoal(p => ({...p, target_amount: v}))} />
            <Text style={s.label}>Target Date (optional)</Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={C.textMuted} value={newGroupGoal.deadline || ''} onChangeText={v => setNewGroupGoal(p => ({...p, deadline: v}))} />
            <TouchableOpacity
              style={[s.btn, !newGroupGoal.title?.trim() && s.btnOff]}
              disabled={!newGroupGoal.title?.trim()}
              onPress={async () => {
                try {
                  await fetch(`${API_URL}/api/groups/${currentGroup.id}/goals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newGroupGoal, target_amount: parseFloat(newGroupGoal.target_amount) || null, created_by: userId }) });
                  setAddGroupGoalVisible(false);
                  setNewGroupGoal({});
                  fetchGroupDetail(currentGroup.id);
                } catch {}
              }}
            >
              <Text style={s.btnText}>Create Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.linkRow} onPress={() => setAddGroupGoalVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Insights Range Dropdown Modal */}
      <Modal visible={insightsDropdownVisible} animationType="fade" transparent onRequestClose={() => setInsightsDropdownVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setInsightsDropdownVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Select Date Range</Text>
            {Object.entries(RANGE_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => { setInsightsRange(key); setInsightsDropdownVisible(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <Text style={{ color: insightsRange === key ? C.accent : C.text, fontSize: 15, fontWeight: insightsRange === key ? '700' : '400' }}>{label}</Text>
                {insightsRange === key && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.linkRow, { marginTop: 4 }]} onPress={() => setInsightsDropdownVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New User Tutorial Modal */}
      <Modal visible={tutorialVisible} animationType="fade" transparent onRequestClose={() => setTutorialVisible(false)}>
        <View style={[s.modalOverlay, { justifyContent: 'center', paddingHorizontal: 24 }]}>
          <View style={[s.modalCard, { borderRadius: 24, paddingBottom: 28 }]}>
            {/* Step indicators */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View key={i} style={{ width: i === tutorialStep ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === tutorialStep ? C.accent : C.border }} />
              ))}
            </View>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: TUTORIAL_STEPS[tutorialStep]?.color, justifyContent: 'center', alignItems: 'center', shadowColor: TUTORIAL_STEPS[tutorialStep]?.color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 }}>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{TUTORIAL_STEPS[tutorialStep]?.icon}</Text>
              </View>
            </View>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>{TUTORIAL_STEPS[tutorialStep]?.title}</Text>
            <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>{TUTORIAL_STEPS[tutorialStep]?.body}</Text>
            {/* Buttons */}
            <TouchableOpacity
              style={s.btn}
              onPress={() => {
                if (tutorialStep < TUTORIAL_STEPS.length - 1) {
                  setTutorialStep(t => t + 1);
                } else {
                  setTutorialVisible(false);
                }
              }}
            >
              <Text style={s.btnText}>{tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next →' : 'Get Started!'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.linkRow, { paddingVertical: 6 }]} onPress={() => setTutorialVisible(false)}>
              <Text style={[s.linkText, { fontSize: 12 }]}>Skip tutorial</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transaction Sort Dropdown Modal */}
      <Modal visible={txSortDropdownVisible} animationType="fade" transparent onRequestClose={() => setTxSortDropdownVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setTxSortDropdownVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Sort Transactions</Text>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => { setTxSortBy(key); setTxSortDropdownVisible(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <Text style={{ color: txSortBy === key ? C.accent : C.text, fontSize: 15, fontWeight: txSortBy === key ? '700' : '400' }}>{label}</Text>
                {txSortBy === key && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.linkRow, { marginTop: 4 }]} onPress={() => setTxSortDropdownVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transaction Category Filter Dropdown Modal */}
      <Modal visible={txFilterDropdownVisible} animationType="fade" transparent onRequestClose={() => setTxFilterDropdownVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setTxFilterDropdownVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Filter by Category</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {[['all', 'All Categories'], ...Array.from(new Set(transactions.map(tx => tx.category).filter(Boolean))).sort().map(c => [c, c.replace(/_/g, ' ')])].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setTxFilterCategory(key); setTxFilterDropdownVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}
                >
                  <Text style={{ color: txFilterCategory === key ? C.accent : C.text, fontSize: 15, fontWeight: txFilterCategory === key ? '700' : '400' }}>{label}</Text>
                  {txFilterCategory === key && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.linkRow, { marginTop: 4 }]} onPress={() => setTxFilterDropdownVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Insights Category Filter Dropdown Modal */}
      <Modal visible={insightsCatDropdownVisible} animationType="fade" transparent onRequestClose={() => setInsightsCatDropdownVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setInsightsCatDropdownVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Filter by Category</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {[['all', 'All Categories'], ...Array.from(new Set(transactions.map(tx => tx.category).filter(Boolean))).sort().map(c => [c, c.replace(/_/g, ' ')])].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setInsightsCatFilter(key); setSelectedCategory(null); setInsightsCatDropdownVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}
                >
                  <Text style={{ color: insightsCatFilter === key ? C.accent : C.text, fontSize: 15, fontWeight: insightsCatFilter === key ? '700' : '400' }}>{label}</Text>
                  {insightsCatFilter === key && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.linkRow, { marginTop: 4 }]} onPress={() => setInsightsCatDropdownVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════
const makeStyles = (C) => StyleSheet.create({
  appWrap: { flex: 1, backgroundColor: C.bg },
  bg: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tab: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  splashBg: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  splashIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: C.accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  splashIconText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  splashTitle: { fontSize: 30, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  splashSub: { fontSize: 15, color: C.textSub },

  authScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  authTop: { alignItems: 'center', marginBottom: 36 },
  authTitle: { fontSize: 26, fontWeight: 'bold', color: C.text, marginTop: 20, marginBottom: 8 },
  authSub: { fontSize: 14, color: C.textSub },
  nameRow: { flexDirection: 'row', marginBottom: 0 },
  label: { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15, marginBottom: 18 },
  errBox: { backgroundColor: '#1f0808', borderWidth: 1, borderColor: '#5c1515', borderRadius: 10, padding: 12, marginBottom: 16 },
  errText: { color: '#fca5a5', fontSize: 13 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOff: { opacity: 0.55 },
  linkRow: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: C.textSub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerGreet: { fontSize: 12, color: C.textSub, marginBottom: 2 },
  headerName: { fontSize: 20, fontWeight: 'bold', color: C.text },
  menuBtn: { padding: 8, alignItems: 'flex-end', justifyContent: 'center', gap: 5 },
  menuLine: { height: 2, width: 24, backgroundColor: C.text, borderRadius: 2 },

  balanceCard: { borderRadius: 22, padding: 24, marginBottom: 20, marginTop: 8, backgroundColor: C.accent, shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 8 },
  balanceAmt: { fontSize: 42, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  balanceSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  chip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10, minWidth: 120 },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipTitle: { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  chipTitleActive: { color: '#fff' },
  chipSub: { color: C.textMuted, fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  statLabel: { color: C.textSub, fontSize: 12, marginBottom: 8 },
  statVal: { fontSize: 22, fontWeight: 'bold', color: C.text },

  reconnectCard: { backgroundColor: '#1a0c0c', borderWidth: 1, borderColor: '#5c2020', borderRadius: 16, padding: 18, marginBottom: 20 },
  quickCard: { backgroundColor: C.surface, borderWidth: 1.5, borderRadius: 16, padding: 16, marginBottom: 12 },
  reconnectTitle: { color: '#fca5a5', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  reconnectText: { color: '#f87171', fontSize: 13, marginBottom: 14, lineHeight: 20 },

  refreshBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 20 },
  refreshText: { color: C.textSub, fontSize: 13, fontWeight: '600' },

  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },

  catRow: { marginBottom: 14 },
  catInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  catName: { color: C.text, fontSize: 14, fontWeight: '500' },
  catAmt: { color: C.textSub, fontSize: 14 },
  barBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },

  connectCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 22, marginBottom: 20 },
  connectTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  connectText: { color: C.textSub, fontSize: 13, lineHeight: 20, marginBottom: 18 },

  chartCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, alignItems: 'center' },
  insightCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 12 },
  insightDot: { width: 10, height: 10, borderRadius: 5 },
  pct: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' },
  highlightCard: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 20 },
  highlightLabel: { color: C.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  highlightValue: { color: C.text, fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  highlightSub: { color: C.textSub, fontSize: 13 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  txTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  syncText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  txItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 12 },
  txMerchant: { color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  txMeta: { color: C.textSub, fontSize: 12 },
  txAmt: { color: C.red, fontSize: 15, fontWeight: '700' },

  bubble: { borderRadius: 18, padding: 14, marginBottom: 12, maxWidth: '85%', borderWidth: 1 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderColor: C.border, borderBottomLeftRadius: 4 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: C.accent, borderColor: C.accent, borderBottomRightRadius: 4 },
  bubbleName: { color: C.accent, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 21 },
  chatBar: { flexDirection: 'row', padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  chatInput: { flex: 1, backgroundColor: C.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.border, maxHeight: 100 },
  sendBtn: { width: 48, height: 48, backgroundColor: C.accent, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: C.textMuted },
  sendBtnText: { color: '#fff', fontSize: 22, fontWeight: 'bold', lineHeight: 26 },

  bottomNav: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 14, paddingTop: 10 },
  navTab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 20, color: C.textMuted, marginBottom: 3 },
  navIconOn: { color: C.accent },
  navLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  navLabelOn: { color: C.accent, fontWeight: '700' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, borderTopWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 24 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 20 },
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, backgroundColor: C.surface, zIndex: 21, borderLeftWidth: 1, borderLeftColor: C.border },
  drawerUser: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  avatarText: { fontSize: 30, fontWeight: 'bold', color: '#fff' },
  drawerName: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  drawerEmail: { fontSize: 13, color: C.textSub },
  drawerGroup: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerGroupLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginTop: 6 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  drawerRowText: { color: C.text, fontSize: 15 },
  drawerRowSub: { color: C.textSub, fontSize: 12, marginTop: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  chevron: { color: C.textMuted, fontSize: 22 },
  logoutBtn: { margin: 20, marginTop: 10, backgroundColor: '#1e0808', borderWidth: 1, borderColor: '#5c1515', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  logoutText: { color: C.red, fontSize: 15, fontWeight: '700' },
  subText: { color: C.textSub, fontSize: 14 },
});
