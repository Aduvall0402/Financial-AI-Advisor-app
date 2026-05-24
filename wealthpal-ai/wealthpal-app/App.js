import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, FlatList, ActivityIndicator, Image,
  Animated, Dimensions, Switch, StatusBar, Modal, RefreshControl, Share, Alert,
} from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

// Categories to exclude from all spending calculations (income, transfers, non-purchase flows)
const INCOME_CATEGORIES = new Set([
  'INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'TRANSFER',
  'Income', 'Transfer In', 'Transfer Out', 'Transfer',
  'Payroll', 'PAYROLL', 'INTEREST_EARNED', 'Interest',
  'Refund', 'REFUND', 'LOAN_PROCEEDS',
]);
const isIncomeTx = (tx) => tx.category === 'IGNORED' || INCOME_CATEGORIES.has(tx.category) || INCOME_CATEGORIES.has((tx.category || '').toUpperCase());

// Categories to additionally exclude from "largest purchase" (fixed costs / non-discretionary)
const SKIP_LARGEST_PURCHASE = new Set([
  'TRANSFER_OUT', 'TRANSFER_IN', 'TRANSFER', 'Transfer Out', 'Transfer In', 'Transfer',
  'LOAN_PAYMENT', 'LOAN_PAYMENTS', 'Loan Payments', 'PAYMENT',
]);
const isSkipLargest = (tx) => isIncomeTx(tx) || SKIP_LARGEST_PURCHASE.has(tx.category) || SKIP_LARGEST_PURCHASE.has((tx.category || '').toUpperCase());

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
  textSub: '#7dd8f0',
  textMuted: '#4ab0ce',
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
  { key: 'GROCERY', label: 'Groceries', icon: '🛒' },
  { key: 'DINING', label: 'Dining', icon: '🍽️' },
  { key: 'GENERAL_MERCHANDISE', label: 'Shopping', icon: '🛍️' },
  { key: 'TRANSPORTATION', label: 'Transportation', icon: '🚗' },
  { key: 'TRAVEL', label: 'Travel', icon: '✈️' },
  { key: 'ENTERTAINMENT', label: 'Entertainment', icon: '🎬' },
  { key: 'PERSONAL_CARE', label: 'Personal Care', icon: '💆' },
  { key: 'MEDICAL', label: 'Medical', icon: '🏥' },
  { key: 'RENT_AND_UTILITIES', label: 'Rent & Utilities', icon: '🏠' },
  { key: 'HOME_IMPROVEMENT', label: 'Home Improvement', icon: '🔧' },
  { key: 'GENERAL_SERVICES', label: 'General Services', icon: '⚙️' },
  { key: 'LOAN_PAYMENTS', label: 'Loan Payments', icon: '💳' },
  { key: 'BANK_FEES', label: 'Bank Fees', icon: '🏦' },
  { key: 'OTHER', label: 'Other', icon: '📦' },
  { key: 'IGNORED', label: 'Ignored', icon: '🚫' },
];

const GROCERY_KEYWORDS = ['walmart','kroger','safeway','whole foods','trader joe','aldi','costco','publix','albertsons','wegmans','heb ','stop & shop','grocery','supermarket','food mart','fresh market','sprouts','meijer','winn-dixie','food lion','ingles','harris teeter','market basket','food 4 less','smart & final','stater bros','giant food','acme','shoprite','food city'];
const DINING_KEYWORDS = ['restaurant','cafe','coffee','starbucks','mcdonald','burger','pizza','sushi','taco','subway','chipotle','diner','grill','bistro','kitchen','eatery','donut','bakery','sandwich','deli','bar ','tavern','pub ','bbq','wings','noodle','ramen','pho','thai','chinese','mexican','steakhouse','chick-fil','dunkin','panera','five guys','shake shack','domino','papa john','kfc','popeye','wendy'];

function refineFoodCategory(merchantName, rawCategory) {
  if (rawCategory !== 'FOOD_AND_DRINK') return rawCategory;
  const m = (merchantName || '').toLowerCase();
  if (GROCERY_KEYWORDS.some(k => m.includes(k))) return 'GROCERY';
  if (DINING_KEYWORDS.some(k => m.includes(k))) return 'DINING';
  return 'DINING'; // default unknown food to dining
}

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
  Groceries: 'G', Grocery: 'G', GROCERY: 'G', Dining: 'D', DINING: 'D',
  'Food and Drink': 'F', Food: 'F', Restaurants: 'D',
  Gas: 'G', Transportation: 'T', Travel: 'T', Shopping: 'S',
  Entertainment: 'E', Subscriptions: 'S', Utilities: 'U',
  Health: 'H', Healthcare: 'H', Other: 'O',
  FOOD_AND_DRINK: 'F', GENERAL_MERCHANDISE: 'S', TRANSPORTATION: 'T',
  TRAVEL: '✈', ENTERTAINMENT: 'E', PERSONAL_CARE: 'P', MEDICAL: '+',
  RENT_AND_UTILITIES: 'U', HOME_IMPROVEMENT: 'H', GENERAL_SERVICES: 'G',
  LOAN_PAYMENTS: '$', BANK_FEES: 'B',
};

const CAT_BG = {
  Groceries: '#059669', Grocery: '#059669', GROCERY: '#059669',
  Dining: '#d97706', DINING: '#d97706', Restaurants: '#d97706',
  'Food and Drink': '#d97706', Food: '#d97706',
  Gas: '#2563eb', Transportation: '#2563eb',
  Travel: '#7c3aed', Shopping: '#db2777', Entertainment: '#dc2626',
  Subscriptions: '#0891b2', Utilities: '#65a30d', Health: '#059669',
  Healthcare: '#059669', Other: '#475569',
  FOOD_AND_DRINK: '#d97706', GENERAL_MERCHANDISE: '#db2777', TRANSPORTATION: '#2563eb',
  TRAVEL: '#7c3aed', ENTERTAINMENT: '#dc2626', PERSONAL_CARE: '#0891b2',
  MEDICAL: '#059669', RENT_AND_UTILITIES: '#65a30d', HOME_IMPROVEMENT: '#b45309',
  GENERAL_SERVICES: '#6366f1', LOAN_PAYMENTS: '#ef4444', BANK_FEES: '#64748b',
  IGNORED: '#374151',
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
  const catDef = PLAID_CATEGORIES.find(c => c.key === category);
  if (catDef) {
    const bg = CAT_BG[category] || '#475569';
    return (
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, lineHeight: 24 }}>{catDef.icon}</Text>
      </View>
    );
  }
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

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d) {
  if (!d) return '';
  const parts = String(d).slice(0, 10).split('-');
  if (parts.length < 3) return String(d);
  return `${MONTHS_SHORT[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
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

  // Subscription / freemium
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [aiRequestsUsed, setAiRequestsUsed] = useState(0);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([
    { id: '0', role: 'assistant', text: "Hi! I'm your Finlit assistant. Ask me anything about your finances!" },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerX = useRef(new Animated.Value(320)).current;
  const overlayO = useRef(new Animated.Value(0)).current;

  // Theme — dark or light mode, brand blue accent always
  const BRAND_BLUE = '#16B7F6';
  // Brand gradient palette: deep blue → cyan → teal → mint
  const GRAD = ['#1E5EFF', '#16B7F6', '#1EDFD5', '#51F0C0'];
  const [isDarkMode, setIsDarkMode] = useState(true);
  const themeBg = isDarkMode ? '#060c17' : '#f1f5f9';
  const themeAccent = BRAND_BLUE;

  const C = useMemo(() => {
    if (!isDarkMode) {
      return {
        ...BASE,
        bg: '#f1f5f9', surface: '#ffffff', surface2: '#e2e8f0', border: '#cbd5e1',
        text: '#0f172a', textSub: '#0369a1', textMuted: '#0e7490',
        accent: BRAND_BLUE, blue: '#1E5EFF',
        green: '#059669', red: '#dc2626', amber: '#d97706',
      };
    }
    const surfaces = deriveSurfaces('#060c17');
    return { ...BASE, ...surfaces, bg: '#060c17', accent: BRAND_BLUE, blue: '#1E5EFF' };
  }, [isDarkMode]);
  // Gradient-based category colors: cycle through the full palette
  const CAT_COLORS = useMemo(() => [
    '#1E5EFF', '#16B7F6', '#1EDFD5', '#51F0C0',
    C.amber, C.red, '#a855f7', '#f97316',
    '#1E5EFF', '#16B7F6', '#1EDFD5', '#51F0C0',
  ], [C]);
  const CHART_CFG = useMemo(() => ({
    backgroundColor: C.surface, backgroundGradientFrom: C.surface, backgroundGradientTo: C.surface,
    decimalPlaces: 0,
    color: (o = 1) => `rgba(${hexToRgb(C.accent)},${o})`,
    labelColor: () => C.textSub,
    propsForDots: { r: '4', strokeWidth: '2', stroke: C.accent },
    propsForBackgroundLines: { stroke: C.border },
  }), [C]);

  const niceChartMax = (vals) => {
    const mx = Math.max(...vals.filter(v => v > 0 && isFinite(v)));
    if (!mx || !isFinite(mx)) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(mx)));
    const n = mx / mag;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * mag;
  };
  const fmtYLabel = (v) => { const n = Math.round(Number(v)); return '$' + (n >= 1000 ? Math.round(n / 1000) + 'k' : n); };
  const s = useMemo(() => makeStyles(C), [C]);

  const monthlySpend = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return transactions
      .filter(tx => new Date(tx.transaction_date).getTime() >= cutoff && !isIncomeTx(tx))
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
    { icon: '⌂', color: '#7c3aed', title: 'Welcome to Finlit', body: 'Your smart financial companion. We\'ll walk you through the key features to get you started.' },
    { icon: 'B', color: '#3b82f6', title: 'Connect Your Bank', body: 'Tap the ⚙ gear icon in the top right and select "Connect Bank" to securely link your accounts via Plaid.' },
    { icon: '≡', color: '#10b981', title: 'View Transactions', body: 'The Txns tab shows all your transactions. Use Sort to organize by date, amount, or category. Tap any transaction to edit it.' },
    { icon: '◈', color: BRAND_BLUE, title: 'Get Insights', body: 'The Insights tab shows spending charts and breakdowns by category. Tap categories to filter the chart.' },
    { icon: '✦', color: '#ec4899', title: 'Ask the AI', body: 'The AI tab is your personal finance advisor. Ask anything — "How much did I spend last week?" or "Where can I cut back?"' },
    { icon: '☰', color: '#06b6d4', title: 'More Features', body: 'The More tab has Goals, Groups, Budget, Net Worth, and Credit Score. Set budgets and goals to stay on track!' },
  ];

  // Settings
  const [biometrics, setBiometrics] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [widgetInfoVisible, setWidgetInfoVisible] = useState(false);

  // Chart type for insights
  const [chartType, setChartType] = useState('line');
  const [chartTooltip, setChartTooltip] = useState(null); // { index, value, x, y }

  // Insights filters
  const [insightsRange, setInsightsRange] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Transaction edit
  const [editTxVisible, setEditTxVisible] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editTxFields, setEditTxFields] = useState({});
  const [savingTx, setSavingTx] = useState(false);
  const [rememberCategoryRule, setRememberCategoryRule] = useState(false);
  const [contributeToGoalId, setContributeToGoalId] = useState(null);

  // Receipt scanning
  const [receiptScanVisible, setReceiptScanVisible] = useState(false);
  const [receiptScanLoading, setReceiptScanLoading] = useState(false);
  const [receiptFields, setReceiptFields] = useState({});
  const [receiptScanError, setReceiptScanError] = useState('');
  const [savingReceipt, setSavingReceipt] = useState(false);

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
  const [acctShareModalVisible, setAcctShareModalVisible] = useState(false);
  const [acctShareSelectedIds, setAcctShareSelectedIds] = useState(new Set());

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
  const [budgetGlobalPeriod, setBudgetGlobalPeriod] = useState('monthly');
  const [customCategories, setCustomCategories] = useState([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [categoryRules, setCategoryRules] = useState({}); // merchant -> category
  const saveCategoryRules = (rules) => { setCategoryRules(rules); AsyncStorage.setItem('categoryRules', JSON.stringify(rules)); };

  // Transactions sort
  const [txSortBy, setTxSortBy] = useState('date_desc');
  const [txSortDropdownVisible, setTxSortDropdownVisible] = useState(false);
  const [txFilterCategory, setTxFilterCategory] = useState('all');
  const [txFilterDropdownVisible, setTxFilterDropdownVisible] = useState(false);
  const [txFilterAccount, setTxFilterAccount] = useState('all');
  const [txFilterAccountVisible, setTxFilterAccountVisible] = useState(false);
  const [dbAccountMap, setDbAccountMap] = useState({}); // db_uuid → display label

  // Transactions bulk select
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [insightsCatFilter, setInsightsCatFilter] = useState('all');
  const [insightsCatDropdownVisible, setInsightsCatDropdownVisible] = useState(false);

  // More tab sub-section + group share loading — MUST be declared here (before any early returns)
  const [moreSection, setMoreSection] = useState(null);
  const [groupShareLoading, setGroupShareLoading] = useState(false);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

  // Auth token for secure API calls
  const [authToken, setAuthToken] = useState(null);
  const authTokenRef = useRef(null);

  // Payday detection (auto from transactions)
  const [paydayInfo, setPaydayInfo] = useState(null); // { nextDate, daysUntil }
  // User-set payday preference
  const [userPayday, setUserPayday] = useState(null); // { nextDate: 'YYYY-MM-DD', frequency: 'weekly'|'biweekly'|'monthly' }
  const [paydayModalVisible, setPaydayModalVisible] = useState(false);
  const [paydayNextDate, setPaydayNextDate] = useState('');
  const [paydayFreq, setPaydayFreq] = useState('biweekly');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  // Post-sync transaction review
  const [postSyncTxs, setPostSyncTxs] = useState([]);
  const [postSyncVisible, setPostSyncVisible] = useState(false);
  const [postSyncIdx, setPostSyncIdx] = useState(0);
  const [postSyncCat, setPostSyncCat] = useState('');

  // Currency
  const [currency, setCurrency] = useState('USD');
  const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  ];
  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';
  const fmtCurrency = useCallback((n) => `${currencySymbol}${fmtMoney(n)}`, [currencySymbol]);

  // Apply category rules + food refinement to get the display category for a transaction
  const getEffectiveCategory = useCallback((tx) => {
    const merchant = (tx.merchant_name || tx.description || '').toLowerCase();
    if (categoryRules[merchant]) return categoryRules[merchant];
    return refineFoodCategory(tx.merchant_name || tx.description || '', tx.category);
  }, [categoryRules]);
  const [currencyVisible, setCurrencyVisible] = useState(false);

  // Help & FAQ
  const [helpVisible, setHelpVisible] = useState(false);

  // Auto sync
  const [autoSyncHour, setAutoSyncHour] = useState(6); // default 6am
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSyncTimeVisible, setAutoSyncTimeVisible] = useState(false);

  // Transaction search
  const [txSearch, setTxSearch] = useState('');
  const [txSearchActive, setTxSearchActive] = useState(false);

  // Voice input
  const [isRecording, setIsRecording] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
  const [recordingObj, setRecordingObj] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // Recurring transactions
  const [recurringTxs, setRecurringTxs] = useState([]);
  const [addRecurringVisible, setAddRecurringVisible] = useState(false);
  const [newRecurring, setNewRecurring] = useState({ name: '', amount: '', category: 'OTHER', frequency: 'monthly', day_of_month: 1, interval_days: 7, start_date: '' });
  const [recurringMonth, setRecurringMonth] = useState(new Date());

  // ── Auto sync useEffect ──────────────────────────────
  useEffect(() => {
    if (!autoSyncEnabled || !userIdRef.current) return;
    const checkAutoSync = () => {
      const now = new Date();
      if (now.getHours() !== autoSyncHour) return;
      const lastSync = lastSyncTime || 0;
      const elapsed = Date.now() - lastSync;
      if (elapsed < 23 * 60 * 60 * 1000) return; // 23h lockout
      const newLastSync = Date.now();
      setLastSyncTime(newLastSync);
      AsyncStorage.setItem('lastSyncTime', String(newLastSync));
      syncTransactions();
    };
    checkAutoSync();
    const interval = setInterval(checkAutoSync, 60 * 1000);
    return () => clearInterval(interval);
  }, [autoSyncEnabled, autoSyncHour, lastSyncTime]);

  // ── Fetch Recurring Transactions ─────────────────────
  const fetchRecurring = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const res = await fetch(`${API_URL}/api/recurring/${userIdRef.current}`);
      const d = await res.json();
      setRecurringTxs(d.recurring || []);
    } catch {}
  }, []);

  // Payday auto-detection from income transaction history
  useEffect(() => {
    if (!transactions.length) { setPaydayInfo(null); return; }
    const incomeTxs = transactions
      .filter(tx => isIncomeTx(tx))
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
    if (incomeTxs.length < 2) { setPaydayInfo(null); return; }
    const dates = incomeTxs.slice(0, 6).map(tx => new Date(tx.transaction_date).getTime());
    const gaps = [];
    for (let i = 0; i < dates.length - 1; i++) gaps.push(dates[i] - dates[i + 1]);
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const avgDays = Math.round(avgGap / 86400000);
    if (avgDays < 5 || avgDays > 35) { setPaydayInfo(null); return; }
    const lastPayday = new Date(dates[0]);
    const nextPayday = new Date(lastPayday.getTime() + avgDays * 86400000);
    const today = new Date();
    const daysUntil = Math.round((nextPayday.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > 35) { setPaydayInfo(null); return; }
    setPaydayInfo({ nextDate: nextPayday.toISOString().split('T')[0], daysUntil, frequencyDays: avgDays });
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    let txs = txFilterCategory === 'all'
      ? [...transactions]
      : transactions.filter(tx => tx.category === txFilterCategory);
    if (txFilterAccount !== 'all') txs = txs.filter(tx => tx.account_id === txFilterAccount);
    if (txSearch.trim()) {
      const q = txSearch.trim().toLowerCase();
      txs = txs.filter(tx =>
        (tx.merchant_name || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.category || '').toLowerCase().includes(q)
      );
    }
    switch (txSortBy) {
      case 'date_asc':    return txs.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
      case 'amount_desc': return txs.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
      case 'amount_asc':  return txs.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
      case 'merchant':    return txs.sort((a, b) => (a.merchant_name || '').localeCompare(b.merchant_name || ''));
      case 'category':    return txs.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      default:            return txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    }
  }, [transactions, txSortBy, txFilterCategory, txFilterAccount, txSearch]);

  // Insights dropdown
  const [insightsDropdownVisible, setInsightsDropdownVisible] = useState(false);

  // Groups shared data
  const [groupSharedTx, setGroupSharedTx] = useState([]);
  const [groupBudgets, setGroupBudgets] = useState([]);
  const [addGroupBudgetVisible, setAddGroupBudgetVisible] = useState(false);
  const [newGroupBudgetCat, setNewGroupBudgetCat] = useState('');
  const [newGroupBudgetLimit, setNewGroupBudgetLimit] = useState('');
  const [newGroupBudgetPeriod, setNewGroupBudgetPeriod] = useState('monthly');
  const [groupTxFilterCat, setGroupTxFilterCat] = useState('all');
  const [groupTxFilterOwner, setGroupTxFilterOwner] = useState('all');
  const [groupTxSort, setGroupTxSort] = useState('date_desc');
  const [groupTxFilterVisible, setGroupTxFilterVisible] = useState(false);

  // ── Secure API call helper ───────────────────────────
  const apiCall = useCallback((path, options = {}) => {
    const token = authTokenRef.current;
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }, []);

  // ── Theme + persisted prefs ──────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('customCategories').then(v => { if (v) { try { setCustomCategories(JSON.parse(v)); } catch {} } });
    AsyncStorage.getItem('categoryRules').then(v => { if (v) { try { setCategoryRules(JSON.parse(v)); } catch {} } });
    AsyncStorage.getItem('userPayday').then(v => { if (v) { try { setUserPayday(JSON.parse(v)); } catch {} } });
    AsyncStorage.getItem('isDarkMode').then(v => { if (v !== null) setIsDarkMode(v !== 'false'); });
    AsyncStorage.multiGet([
      'displayName',
      'notifOverall', 'notifDaily', 'notifWeekly', 'notifMonthly', 'notifBudget',
      'currency', 'autoSyncHour', 'autoSyncEnabled', 'lastSyncTime',
    ]).then(pairs => {
      const m = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (m.displayName) setDisplayName(m.displayName);
      if (m.notifOverall !== null) setNotifOverall(m.notifOverall === 'true');
      if (m.notifDaily !== null) setNotifDaily(m.notifDaily === 'true');
      if (m.notifWeekly !== null) setNotifWeekly(m.notifWeekly === 'true');
      if (m.notifMonthly !== null) setNotifMonthly(m.notifMonthly === 'true');
      if (m.notifBudget !== null) setNotifBudget(m.notifBudget === 'true');
      if (m.currency) setCurrency(m.currency);
      if (m.autoSyncHour) setAutoSyncHour(parseInt(m.autoSyncHour));
      if (m.autoSyncEnabled) setAutoSyncEnabled(m.autoSyncEnabled === 'true');
      if (m.lastSyncTime) setLastSyncTime(parseInt(m.lastSyncTime));
    });
  }, []);

  const toggleDarkMode = (val) => { setIsDarkMode(val); AsyncStorage.setItem('isDarkMode', val ? 'true' : 'false'); };

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
      const token = data.session.access_token;
      if (token) { setAuthToken(token); authTokenRef.current = token; }
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
      fetchRecurring();
      fetch(`${API_URL}/api/users/${uid}/subscription`).then(r => r.json()).then(d => setIsSubscribed(d.is_subscribed === true)).catch(() => {});
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleSignup = async () => {
    if (!email || !password || !firstName || !lastName) {
      setError('Please fill in all fields'); return;
    }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address'); return; }
    setLoading(true); setError('');
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); return; }
      // If email confirmation is required, show verify screen
      if (data.needs_verification) {
        setPendingVerifyEmail(email);
        setScreen('verify_email');
        return;
      }
      const uid = data.user.id;
      const token = data.session?.access_token;
      if (token) { setAuthToken(token); authTokenRef.current = token; }
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
      fetchRecurring();
      fetch(`${API_URL}/api/users/${uid}/subscription`).then(r => r.json()).then(d => setIsSubscribed(d.is_subscribed === true)).catch(() => {});
      // Show tutorial for new users
      setTimeout(() => { setTutorialStep(0); setTutorialVisible(true); }, 600);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleScanReceipt = async (fromCamera) => {
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true };
    let result;
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Required', 'Camera access is needed to scan receipts.'); return; }
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission Required', 'Photo library access is needed to scan receipts.'); return; }
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
    } catch { return; }
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setReceiptScanLoading(true);
    setReceiptScanError('');
    try {
      const res = await fetch(`${API_URL}/api/ai/scan-receipt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: result.assets[0].base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to scan receipt');
      const tx = data.transaction || {};
      setReceiptFields({
        merchant_name: tx.merchant_name || '',
        amount: tx.amount != null ? String(tx.amount) : '',
        transaction_date: tx.transaction_date || new Date().toISOString().split('T')[0],
        category: tx.category || 'GENERAL_MERCHANDISE',
        description: tx.description || '',
      });
      setReceiptScanVisible(true);
    } catch (err) {
      Alert.alert('Scan Failed', err.message || 'Could not read the receipt. Try again with a clearer image.');
    } finally {
      setReceiptScanLoading(false);
    }
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
      setChatMessages([{ id: '0', role: 'assistant', text: "Hi! I'm your Finlit assistant. Ask me anything about your finances!" }]);
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
        // Build a map from DB UUID → display label (e.g. "Chase Checking, Savings")
        if (data.dbAccounts?.length) {
          const map = {};
          data.dbAccounts.forEach((item, idx) => {
            const names = item.accounts?.map(a => a.name).join(', ') || `Bank ${idx + 1}`;
            map[item.id] = names;
          });
          setDbAccountMap(map);
        }
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
        const txRes = await fetch(`${API_URL}/api/transactions/${userIdRef.current}`);
        const txData = txRes.ok ? await txRes.json() : {};
        const fresh = (txData.transactions || []).filter(tx => !isIncomeTx(tx)).slice(0, 10);
        if (fresh.length > 0) {
          setPostSyncTxs(fresh);
          setPostSyncIdx(0);
          setPostSyncCat(getEffectiveCategory(fresh[0]));
          setPostSyncVisible(true);
        }
        await fetchTransactions();
        autoUpdateGoals();
      }
    } catch (e) { setSyncError('Network error — could not reach server'); }
    finally { setSyncing(false); }
  };

  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = async () => {
    setRefreshing(true);
    await fetchAccounts();
    await fetchTransactions();
    fetchRecurring();
    setRefreshing(false);
  };
  const refreshGoals = async () => {
    setRefreshing(true);
    await fetchGoals();
    setRefreshing(false);
  };
  const refreshBudgets = async () => {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
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
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === b.category && !isIncomeTx(tx))
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
      const limit = parseFloat(b.monthly_limit || 0);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const catLabel = PLAID_CATEGORIES.find(c => c.key === b.category)?.label || b.category;
      const thresholds = [
        { pct: 100, title: `Budget Exceeded: ${catLabel}`, body: `You've spent $${fmtMoney(spent)} — $${fmtMoney(spent - limit)} over your $${fmtMoney(limit)} limit.` },
        { pct: 90, title: `Budget Alert (90%): ${catLabel}`, body: `You've used 90% of your $${fmtMoney(limit)} ${catLabel} budget.` },
        { pct: 75, title: `Budget Alert (75%): ${catLabel}`, body: `75% of your $${fmtMoney(limit)} ${catLabel} budget used.` },
        { pct: 50, title: `Budget Midpoint: ${catLabel}`, body: `You've used half ($${fmtMoney(spent)}) of your $${fmtMoney(limit)} ${catLabel} budget.` },
      ];
      const triggered = thresholds.find(t => pct >= t.pct);
      if (triggered) {
        Notifications.scheduleNotificationAsync({
          content: { title: triggered.title, body: triggered.body, sound: true },
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
    const _d = new Date(); const localToday = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    // Include last 10 turns of conversation history for context
    const history = chatMessages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: msg, today: localToday, history }),
      });
      const data = await res.json();
      if (res.status === 429 && data.rate_limited) {
        setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'You have reached the free plan limit (6 AI requests per 12 hours). Upgrade to Finlit Premium for unlimited access.' }]);
        setAiRequestsUsed(6);
      } else if (!res.ok) {
        setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: `Error: ${data.error || 'Server error. Please try again.'}` }]);
      } else {
        setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.response || 'No response received.' }]);
        if (!isSubscribed) setAiRequestsUsed(prev => Math.min(prev + 1, 6));
      }
    } catch (e) {
      setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: `Connection error: ${e?.message || 'Could not reach server.'}` }]);
    } finally { setLoadingChat(false); }
  };

  // ── Voice Input ─────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission Required', 'Microphone access is needed for voice input.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecordingObj(rec);
      setIsRecording(true);
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRecording = async () => {
    if (!recordingObj) return;
    setIsRecording(false);
    setTranscribingVoice(true);
    try {
      await recordingObj.stopAndUnloadAsync();
      const uri = recordingObj.getURI();
      setRecordingObj(null);
      if (!uri) { setTranscribingVoice(false); return; }
      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' });
      const res = await fetch(`${API_URL}/api/ai/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      const data = await res.json();
      setTranscribingVoice(false);
      if (data.text) {
        // Reveal words one by one for a natural typing effect
        const words = data.text.trim().split(/\s+/);
        const prefix = chatInput ? chatInput + ' ' : '';
        let idx = 0;
        const tick = setInterval(() => {
          idx++;
          setChatInput(prefix + words.slice(0, idx).join(' '));
          if (idx >= words.length) clearInterval(tick);
        }, 80);
      }
    } catch {
      setTranscribingVoice(false);
      Alert.alert('Error', 'Could not transcribe audio.');
    }
  };

  const speakMessage = (msg) => {
    if (speakingMsgId === msg.id) {
      Speech.stop();
      setSpeakingMsgId(null);
    } else {
      Speech.stop();
      setSpeakingMsgId(msg.id);
      Speech.speak(msg.text, {
        onDone: () => setSpeakingMsgId(null),
        onError: () => setSpeakingMsgId(null),
        rate: 0.95,
      });
    }
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
      const [detailRes, sharedRes, budgetRes] = await Promise.all([
        fetch(`${API_URL}/api/groups/${groupId}/detail`),
        fetch(`${API_URL}/api/groups/${groupId}/shared-transactions`),
        fetch(`${API_URL}/api/groups/${groupId}/budgets`),
      ]);
      if (detailRes.ok) setGroupDetail(await detailRes.json());
      if (sharedRes.ok) { const d = await sharedRes.json(); setGroupSharedTx(d.transactions || []); }
      if (budgetRes.ok) { const d = await budgetRes.json(); setGroupBudgets(d.budgets || []); }
      else setGroupBudgets([]);
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
        if (goal.category) {
          // Auto-contribute: sum transactions matching the linked category
          total = transactions
            .filter(tx => tx.category === goal.category || getEffectiveCategory(tx) === goal.category)
            .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
        } else {
          total = transactions
            .filter(tx => {
              const cat = (tx.category || '').toLowerCase();
              const merch = (tx.merchant_name || '').toLowerCase();
              return cat.includes('transfer') || cat.includes('saving') || merch.includes('saving');
            })
            .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
        }
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
    if (period === 'paycycle') {
      // 1) User-set payday takes priority
      if (userPayday && userPayday.nextDate) {
        const freqDays = userPayday.frequency === 'weekly' ? 7 : userPayday.frequency === 'biweekly' ? 14 : 30;
        const msPerCycle = freqDays * 86400000;
        // Walk backward from nextDate to find the most recent payday <= now
        const anchor = new Date(userPayday.nextDate + 'T00:00:00');
        while (anchor > now) anchor.setTime(anchor.getTime() - msPerCycle);
        return anchor.toISOString().split('T')[0];
      }
      // 2) Budget-level paycycle_start override
      if (paycycleStart) {
        const freqDays = paycycleFreq === 'weekly' ? 7 : paycycleFreq === 'biweekly' ? 14 : 30;
        const anchor = new Date(paycycleStart);
        const msPerCycle = freqDays * 86400000;
        const elapsed = now.getTime() - anchor.getTime();
        const cycleOffset = elapsed % msPerCycle;
        const cycleStart = new Date(now.getTime() - cycleOffset);
        return cycleStart.toISOString().split('T')[0];
      }
      // 3) Auto-detected pay cycle from income transactions
      if (paydayInfo) {
        const nextPayday = new Date(paydayInfo.nextDate + 'T00:00:00');
        const cycleStart = new Date(nextPayday.getTime() - paydayInfo.frequencyDays * 86400000);
        return cycleStart.toISOString().split('T')[0];
      }
    }
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // monthly
  };

  // ── CSV Export ──────────────────────────────────────
  const exportCSV = async () => {
    const txsToExport = bulkSelectMode && selectedTxIds.size > 0
      ? sortedTransactions.filter(tx => selectedTxIds.has(tx.id || tx.plaid_transaction_id))
      : sortedTransactions;
    const header = 'Date,Merchant,Category,Amount\n';
    const rows = txsToExport.map(tx =>
      `${tx.transaction_date},"${(tx.merchant_name || '').replace(/"/g, '""')}","${(tx.category || '').replace(/"/g, '""')}",${parseFloat(tx.amount || 0).toFixed(2)}`
    ).join('\n');
    const csv = header + rows;
    try {
      const fileUri = FileSystem.cacheDirectory + `wealthpal_transactions_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Finlit Transactions (${txsToExport.length})`,
        UTI: 'public.comma-separated-values-text',
      });
    } catch { /* user dismissed */ }
  };

  // ── Insight helpers ─────────────────────────────────
  const getFilteredTx = () => {
    const ranges = { '7d': 7, '30d': 30, '3m': 90, '6m': 180, 'all': 99999 };
    const days = ranges[insightsRange] || 30;
    const cutoff = Date.now() - days * 86400000;
    let txs = transactions.filter(tx => new Date(tx.transaction_date).getTime() >= cutoff && !isIncomeTx(tx));
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
    const incomeTxs = transactions.filter(tx => isIncomeTx(tx));
    const now = new Date();
    const dayKey = (d) => {
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    };

    if (insightsRange === '7d') {
      const labels = [], data = [], incomeData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = dayKey(d);
        labels.push(`${d.getMonth()+1}/${d.getDate()}`);
        data.push(txs.filter(tx => tx.transaction_date === key).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
        incomeData.push(incomeTxs.filter(tx => tx.transaction_date === key).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
      }
      return { labels, data, incomeData, scrollable: true };
    }

    if (insightsRange === '30d') {
      const labels = [], data = [], incomeData = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = dayKey(d);
        labels.push(`${d.getMonth()+1}/${d.getDate()}`);
        data.push(txs.filter(tx => tx.transaction_date === key).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
        incomeData.push(incomeTxs.filter(tx => tx.transaction_date === key).reduce((s, tx) => s + parseFloat(tx.amount || 0), 0));
      }
      return { labels, data, incomeData, scrollable: true };
    }

    if (insightsRange === '3m' || insightsRange === '6m') {
      const count = insightsRange === '3m' ? 3 : 6;
      const months = {}, incomeMonths = {}, labels = [];
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        labels.push(MONTHS_SHORT[d.getMonth()]);
        months[key] = 0; incomeMonths[key] = 0;
      }
      txs.forEach(tx => { const key = (tx.transaction_date || '').slice(0, 7); if (months[key] !== undefined) months[key] += parseFloat(tx.amount || 0); });
      incomeTxs.forEach(tx => { const key = (tx.transaction_date || '').slice(0, 7); if (incomeMonths[key] !== undefined) incomeMonths[key] += parseFloat(tx.amount || 0); });
      return { labels, data: Object.values(months), incomeData: Object.values(incomeMonths), scrollable: false };
    }

    // 'all' — monthly buckets
    if (!txs.length) return { labels: ['No data'], data: [0], incomeData: [0], scrollable: false };
    const monthSet = {}, incomeSet = {};
    txs.forEach(tx => { const key = (tx.transaction_date || '').slice(0, 7); if (key) monthSet[key] = (monthSet[key] || 0) + parseFloat(tx.amount || 0); });
    incomeTxs.forEach(tx => { const key = (tx.transaction_date || '').slice(0, 7); if (key) incomeSet[key] = (incomeSet[key] || 0) + parseFloat(tx.amount || 0); });
    const sorted = Object.keys(monthSet).sort();
    return {
      labels: sorted.map(k => MONTHS_SHORT[parseInt(k.split('-')[1]) - 1]),
      data: sorted.map(k => monthSet[k]),
      incomeData: sorted.map(k => incomeSet[k] || 0),
      scrollable: false,
    };
  };

  // ════════════════════════════════════════════════════
  // SPLASH
  // ════════════════════════════════════════════════════
  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: '#060c17', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#060c17" />
        {/* Background decorative pattern */}
        <View style={{ position: 'absolute', top: -120, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: '#1E5EFF', opacity: 0.07 }} />
        <View style={{ position: 'absolute', top: 40, right: -60, width: 200, height: 200, borderRadius: 100, borderWidth: 1.5, borderColor: '#16B7F6', opacity: 0.18 }} />
        <View style={{ position: 'absolute', top: 120, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: '#1EDFD5', opacity: 0.05 }} />
        <View style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: '#16B7F6', opacity: 0.07 }} />
        <View style={{ position: 'absolute', bottom: 80, right: -40, width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: '#1EDFD5', opacity: 0.15 }} />
        <View style={{ position: 'absolute', bottom: 200, left: 30, width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: '#51F0C0', opacity: 0.2 }} />
        <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }], alignItems: 'center' }}>
          <Image
            source={require('./assets/ChatGPT Image May 23, 2026, 02_15_23 PM.png')}
            style={{ width: 300, height: 180, resizeMode: 'contain' }}
          />
          <ActivityIndicator color={BRAND_BLUE} style={{ marginTop: 40 }} />
        </Animated.View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════
  // AUTH
  // ════════════════════════════════════════════════════
  if (screen === 'login') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
        {/* Background decorative pattern */}
        <View style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: 170, backgroundColor: '#1E5EFF', opacity: isDarkMode ? 0.07 : 0.05 }} />
        <View style={{ position: 'absolute', top: 60, right: -50, width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: '#16B7F6', opacity: isDarkMode ? 0.18 : 0.25 }} />
        <View style={{ position: 'absolute', top: 160, left: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: '#1EDFD5', opacity: isDarkMode ? 0.05 : 0.06 }} />
        <View style={{ position: 'absolute', bottom: -60, left: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: '#16B7F6', opacity: isDarkMode ? 0.07 : 0.06 }} />
        <View style={{ position: 'absolute', bottom: 100, right: -30, width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: '#1EDFD5', opacity: isDarkMode ? 0.15 : 0.2 }} />
        <View style={{ position: 'absolute', bottom: 260, left: 20, width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#51F0C0', opacity: isDarkMode ? 0.2 : 0.25 }} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 36 }}>
            <Image
              source={require('./assets/ChatGPT Image May 23, 2026, 02_15_23 PM.png')}
              style={{ width: 280, height: 168, resizeMode: 'contain' }}
            />
            <Text style={{ color: C.textSub, fontSize: 14, marginTop: 16, letterSpacing: 0.3 }}>Your smart finance companion</Text>
          </View>
          {!!error && <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>}
          <Text style={[s.label, { marginTop: 4 }]}>Email</Text>
          <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} placeholder="••••••••" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
          <TouchableOpacity style={[s.btn, { marginTop: 10 }, loading && s.btnOff]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setScreen('signup'); setError(''); }} style={[s.linkRow, { marginTop: 4 }]}>
            <Text style={s.linkText}>Don't have an account? <Text style={s.linkAccent}>Sign up</Text></Text>
          </TouchableOpacity>
          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    );
  }

  if (screen === 'signup') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
        {/* Background decorative pattern */}
        <View style={{ position: 'absolute', top: -100, right: -100, width: 340, height: 340, borderRadius: 170, backgroundColor: '#1E5EFF', opacity: isDarkMode ? 0.07 : 0.05 }} />
        <View style={{ position: 'absolute', top: 60, right: -50, width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: '#16B7F6', opacity: isDarkMode ? 0.18 : 0.25 }} />
        <View style={{ position: 'absolute', top: 160, left: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: '#1EDFD5', opacity: isDarkMode ? 0.05 : 0.06 }} />
        <View style={{ position: 'absolute', bottom: -60, left: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: '#16B7F6', opacity: isDarkMode ? 0.07 : 0.06 }} />
        <View style={{ position: 'absolute', bottom: 100, right: -30, width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: '#1EDFD5', opacity: isDarkMode ? 0.15 : 0.2 }} />
        <View style={{ position: 'absolute', bottom: 260, left: 20, width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#51F0C0', opacity: isDarkMode ? 0.2 : 0.25 }} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', paddingTop: 44, paddingBottom: 24 }}>
            <Image
              source={require('./assets/ChatGPT Image May 23, 2026, 02_15_23 PM.png')}
              style={{ width: 200, height: 120, resizeMode: 'contain' }}
            />
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '700', marginTop: 16 }}>Create Account</Text>
            <Text style={{ color: C.textSub, fontSize: 14, marginTop: 4 }}>Join Finlit today</Text>
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
          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    );
  }

  if (screen === 'verify_email') {
    return (
      <View style={s.bg}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ScrollView contentContainerStyle={s.authScroll}>
          <View style={s.authTop}>
            <View style={[s.splashIcon, { backgroundColor: C.green }]}><Text style={s.splashIconText}>✓</Text></View>
            <Text style={s.authTitle}>Check Your Email</Text>
            <Text style={s.authSub}>We sent a verification link to</Text>
            <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15, marginTop: 4 }}>{pendingVerifyEmail}</Text>
          </View>
          <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>
              1. Open the email from Finlit{'\n'}
              2. Click the verification link{'\n'}
              3. Come back here and sign in
            </Text>
          </View>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}
            onPress={async () => {
              try {
                await fetch(`${API_URL}/api/auth/resend-verification`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingVerifyEmail }) });
                Alert.alert('Sent', 'Verification email resent. Check your inbox.');
              } catch { Alert.alert('Error', 'Could not resend. Try again.'); }
            }}
          >
            <Text style={{ color: C.text, fontWeight: '600' }}>Resend Email</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setScreen('login'); setError(''); }} style={s.linkRow}>
            <Text style={s.linkText}>Already verified? <Text style={s.linkAccent}>Sign in</Text></Text>
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
      .filter(tx => (tx.transaction_date || '') >= new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0] && !isIncomeTx(tx))
      .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
      >
        {/* Balance card */}
        <View style={s.balanceCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>{selectedAccount ? selectedAccount.name.toUpperCase() : 'TOTAL BALANCE'}</Text>
              <Text style={s.balanceAmt}>{fmtCurrency(selectedAccount?.balances?.current || 0)}</Text>
              {selectedAccount && <Text style={s.balanceSub}>{selectedAccount.subtype} · {selectedAccount.type}</Text>}
            </View>
            {(loadingAccounts || loadingTx) && (
              <ActivityIndicator color={C.accent} size="small" style={{ marginTop: 4 }} />
            )}
          </View>
        </View>

        {/* Account pills */}
        {accounts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, marginTop: -4 }}>
            {accounts.map(acc => (
              <TouchableOpacity
                key={acc.account_id}
                style={[s.acctPill, selectedAccount?.account_id === acc.account_id && s.acctPillActive]}
                onPress={() => setSelectedAccount(acc)}
              >
                <Text style={[s.acctPillText, selectedAccount?.account_id === acc.account_id && { color: '#fff' }]}>
                  {acc.name} · {fmtCurrency(acc.balances?.current || 0)}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 8 }} />
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

        {/* Payday banner */}
        {paydayInfo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.green + '55' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 18 }}>💰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>
                {paydayInfo.daysUntil === 0 ? 'Payday is today!' : `${paydayInfo.daysUntil} day${paydayInfo.daysUntil === 1 ? '' : 's'} until payday`}
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                Next: {fmtDate(paydayInfo.nextDate)} · every {paydayInfo.frequencyDays} days
              </Text>
            </View>
          </View>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>30-Day Spend</Text>
            <Text style={s.statVal}>{fmtCurrency(monthlySpend)}</Text>
            <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>Last 30 days</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>7-Day Spend</Text>
            <Text style={s.statVal}>{fmtCurrency(weekSpend)}</Text>
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
                <CatIcon category={getEffectiveCategory(tx)} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txMerchant} numberOfLines={1}>{tx.merchant_name || tx.description || 'Unknown'}</Text>
                  <Text style={s.txMeta}>{fmtDate(tx.transaction_date)} · {(getEffectiveCategory(tx) || 'Other').replace(/_/g, ' ')}</Text>
                </View>
                <Text style={s.txAmt}>-${fmtMoney(tx.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming bills — calendar in a surface card */}
        {recurringTxs.length > 0 && (() => {
          const today = new Date();
          const todayNum = today.getDate();
          const year = today.getFullYear();
          const month = today.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDow = new Date(year, month, 1).getDay();

          const billMap = {};
          for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const d = new Date(year, month, dayNum);
            recurringTxs.forEach(r => {
              const monthlyHit = r.frequency === 'monthly' && r.day_of_month === dayNum;
              const startD = r.start_date ? new Date(r.start_date + 'T00:00:00') : null;
              const diffDays = startD ? Math.round((d - startD) / 86400000) : -1;
              const weeklyHit = r.frequency === 'weekly' && diffDays >= 0 && diffDays % 7 === 0;
              const biweeklyHit = r.frequency === 'biweekly' && diffDays >= 0 && diffDays % 14 === 0;
              if (monthlyHit || weeklyHit || biweeklyHit) {
                if (!billMap[dayNum]) billMap[dayNum] = [];
                billMap[dayNum].push(r);
              }
            });
          }
          if (!Object.keys(billMap).length) return null;

          const totalMonthly = recurringTxs.filter(r => r.frequency === 'monthly').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
          const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
          const BILL_BLUE = BRAND_BLUE;

          return (
            <View style={[s.section, { backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={s.sectionTitle}>Bills — {MONTHS_SHORT[month]} {year}</Text>
                <Text style={{ color: BILL_BLUE, fontSize: 12, fontWeight: '700' }}>${fmtMoney(totalMonthly)}/mo</Text>
              </View>
              {/* Day-of-week headers */}
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {DAY_LABELS.map(d => (
                  <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 }}>{d}</Text>
                  </View>
                ))}
              </View>
              {/* Calendar grid */}
              {Array.from({ length: Math.ceil((firstDow + daysInMonth) / 7) }, (_, week) => (
                <View key={week} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {Array.from({ length: 7 }, (_, dow) => {
                    const cellDay = week * 7 + dow - firstDow + 1;
                    if (cellDay < 1 || cellDay > daysInMonth) return <View key={dow} style={{ flex: 1 }} />;
                    const bills = billMap[cellDay] || [];
                    const isToday = cellDay === todayNum;
                    const isPast = cellDay < todayNum;
                    const hasBill = bills.length > 0;
                    return (
                      <View key={dow} style={{ flex: 1, alignItems: 'center', paddingVertical: 1 }}>
                        <View style={{
                          width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isToday ? BILL_BLUE : hasBill && !isPast ? BILL_BLUE + '22' : 'transparent',
                        }}>
                          <Text style={{
                            color: isToday ? '#fff' : hasBill && !isPast ? BILL_BLUE : isPast ? C.textMuted : C.textSub,
                            fontSize: 12, fontWeight: isToday || (hasBill && !isPast) ? '700' : '400',
                          }}>{cellDay}</Text>
                        </View>
                        {hasBill && !isToday && (
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isPast ? C.textMuted : BILL_BLUE, marginTop: 1 }} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
              {/* Upcoming bill list */}
              {Object.entries(billMap)
                .filter(([d]) => parseInt(d) >= todayNum)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .slice(0, 4)
                .map(([d, bills]) => bills.map((r, i) => (
                  <View key={`${d}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderColor: C.border }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: BILL_BLUE + '18', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Text style={{ color: BILL_BLUE, fontSize: 11, fontWeight: '800' }}>{d}</Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{r.name}</Text>
                    <Text style={{ color: BILL_BLUE, fontSize: 13, fontWeight: '700' }}>-${fmtMoney(r.amount)}</Text>
                  </View>
                )))
              }
            </View>
          );
        })()}

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
            {!userPayday && (
              <TouchableOpacity
                style={[s.quickCard, { borderColor: C.accent }]}
                onPress={() => { setPaydayNextDate(userPayday?.nextDate ?? ''); setPaydayFreq(userPayday?.frequency ?? 'biweekly'); setPaydayModalVisible(true); }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon char="📅" color={C.accent} size={40} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Set Your Payday</Text>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>Tell us when you get paid so paycycle budgets work automatically.</Text>
                  </View>
                  <Text style={{ color: C.accent, fontSize: 20 }}>›</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.quickCard, { borderColor: C.accent }]}
              onPress={() => setActiveTab('chat')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon char="✦" color={C.accent} size={40} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 2 }}>Ask Finlit</Text>
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
    const { labels: chartLabels, data: chartRawData, incomeData: chartIncomeData, scrollable: chartScrollable } = getChartData();
    const chartData = chartRawData.map(v => Math.max(0.01, v));
    const total = filteredTx.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    const avg = filteredTx.length ? total / filteredTx.length : 0;
    const maxTx = filteredTx.filter(tx => !isSkipLargest(tx)).reduce((m, tx) => parseFloat(tx.amount) > parseFloat(m?.amount || 0) ? tx : m, null);
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
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
      >
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
              <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 4 }}>
                Total: ${fmtMoney(chartData.reduce((s, v) => s + (v === 0.01 ? 0 : v), 0))}
              </Text>
            )}
            {chartType === 'line' && (() => {
              const lm = niceChartMax(chartData);
              const realVals = chartData.filter(v => v > 0.01);
              const minVal = realVals.length > 0 ? Math.min(...realVals) : 0;
              const floorVal = Math.max(0, minVal * 0.6);
              const chartH = 200;
              const chartW = chartScrollable ? Math.max(SW - 116, chartLabels.length * 32) : SW - 116;
              const YAXIS_W = 44;
              const yStep = (lm - floorVal) / 4;
              const yLabels = [lm, lm-yStep, lm-2*yStep, lm-3*yStep, floorVal];
              return (
                <View>
                  {chartTooltip && (
                    <View style={{ alignItems: 'center', marginBottom: 6 }}>
                      <View style={{ backgroundColor: C.accent + '22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.accent }}>
                        <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>
                          {chartLabels[chartTooltip.index]}: ${fmtMoney(chartTooltip.value)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: YAXIS_W, height: chartH, justifyContent: 'space-between', paddingTop: 10, paddingBottom: 18, paddingRight: 4 }}>
                      {yLabels.map((val, i) => (
                        <Text key={i} style={{ color: C.textMuted, fontSize: 10, textAlign: 'right' }}>
                          {fmtYLabel(String(Math.round(val)))}
                        </Text>
                      ))}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={chartScrollable} style={{ flex: 1 }}>
                      <LineChart
                        data={{ labels: chartLabels, datasets: [
                          { data: chartData, color: () => C.accent },
                          { data: chartData.map(() => lm), withDots: false, color: () => 'rgba(0,0,0,0)' },
                          { data: chartData.map(() => floorVal), withDots: false, color: () => 'rgba(0,0,0,0)' },
                        ]}}
                        width={chartW + 56} height={chartH} bezier
                        chartConfig={{ ...CHART_CFG, decimalPlaces: 0 }}
                        style={{ borderRadius: 10, marginLeft: -56 }} withInnerLines={false}
                        withVerticalLabels={false}
                        yAxisLabel="" yAxisSuffix="" segments={4}
                        onDataPointClick={({ value, index }) => {
                          const realVal = value < 0.02 ? 0 : value;
                          setChartTooltip(prev => prev?.index === index ? null : { value: realVal, index });
                        }}
                      />
                    </ScrollView>
                  </View>
                </View>
              );
            })()}
            {chartType === 'bar' && (() => {
              const chartW = chartScrollable ? Math.max(SW - 64, chartLabels.length * 32) : SW - 64;
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={chartScrollable}>
                  <BarChart
                    data={{ labels: chartLabels, datasets: [{ data: chartData }] }}
                    width={chartW} height={200}
                    chartConfig={{ ...CHART_CFG, decimalPlaces: 0 }}
                    formatYLabel={fmtYLabel}
                    style={{ borderRadius: 10, marginLeft: -16 }} withInnerLines={false}
                    fromZero yAxisLabel="" yAxisSuffix="" segments={4}
                  />
                </ScrollView>
              );
            })()}
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
              {chartType !== 'pie' ? 'Bar = % of budget limit · tap to filter chart' : 'Switch to line or bar chart to filter by category'}
            </Text>
            {catData.map(([cat, amt], i) => {
              const budgetForCat = budgets.find(b => b.category === cat);
              const budgetLimit = budgetForCat ? parseFloat(budgetForCat.monthly_limit || 0) : 0;
              const pctOfTotal = total > 0 ? Math.round((amt / total) * 100) : 0;
              const pctOfBudget = budgetLimit > 0 ? Math.min(100, Math.round((amt / budgetLimit) * 100)) : null;
              const barPct = pctOfBudget !== null ? pctOfBudget : pctOfTotal;
              const barColor = pctOfBudget !== null
                ? (pctOfBudget >= 100 ? C.red : pctOfBudget >= 75 ? '#1EDFD5' : CAT_COLORS[i % CAT_COLORS.length])
                : CAT_COLORS[i % CAT_COLORS.length];
              const catTxCount = filteredTx.filter(tx => tx.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => chartType !== 'pie' ? setSelectedCategory(isSelected ? null : cat) : null}
                  activeOpacity={chartType !== 'pie' ? 0.7 : 1}
                  style={[s.insightCard, isSelected && { borderColor: barColor, borderWidth: 2 }]}
                >
                  <View style={[s.insightDot, { backgroundColor: barColor, width: 12, height: 12, borderRadius: 6 }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.catInfo}>
                      <Text style={[s.catName, isSelected && { color: barColor }]}>{cat.replace(/_/g,' ')}</Text>
                      <Text style={s.catAmt}>${fmtMoney(amt)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.bar, { width: `${barPct}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>
                      {catTxCount} transaction{catTxCount !== 1 ? 's' : ''} · {pctOfBudget !== null
                        ? `${pctOfBudget}% of $${fmtMoney(budgetLimit)} budget`
                        : `${pctOfTotal}% of total · no budget set`}
                    </Text>
                  </View>
                  <Text style={[s.pct, { color: barColor }]}>{pctOfBudget !== null ? `${pctOfBudget}%` : `${pctOfTotal}%`}</Text>
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
        {txSearchActive ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[s.chatInput, { flex: 1, marginBottom: 0, paddingVertical: 9, height: 40 }]}
              placeholder="Search transactions..."
              placeholderTextColor={C.textMuted}
              value={txSearch}
              onChangeText={setTxSearch}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setTxSearchActive(false); setTxSearch(''); }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.sectionTitle}>Transactions</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {bulkSelectMode ? (
                <>
                  <TouchableOpacity style={[s.syncBtn, { backgroundColor: C.accent + '22', borderColor: C.accent }]} onPress={exportCSV}>
                    <Text style={[s.syncText, { color: C.accent }]}>Export {selectedTxIds.size > 0 ? `(${selectedTxIds.size})` : 'All'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.syncBtn} onPress={() => { setBulkSelectMode(false); setSelectedTxIds(new Set()); }}>
                    <Text style={s.syncText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={s.syncBtn} onPress={exportCSV}>
                    <Text style={s.syncText}>↓ CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.syncBtn} disabled={receiptScanLoading} onPress={() => Alert.alert('Scan Receipt', 'Choose a source', [
                    { text: 'Camera', onPress: () => handleScanReceipt(true) },
                    { text: 'Gallery', onPress: () => handleScanReceipt(false) },
                    { text: 'Cancel', style: 'cancel' },
                  ])}>
                    {receiptScanLoading ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.syncText}>📷</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.syncBtn} onPress={() => setTxSearchActive(true)}>
                    <Text style={s.syncText}>🔍</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}
      </View>
      {bulkSelectMode && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ color: C.textSub, fontSize: 13 }}>
            {selectedTxIds.size === 0 ? 'Tap transactions to select' : `${selectedTxIds.size} selected`}
          </Text>
          <TouchableOpacity onPress={() => {
            if (selectedTxIds.size === sortedTransactions.length) { setSelectedTxIds(new Set()); }
            else { setSelectedTxIds(new Set(sortedTransactions.map(t => t.id || t.plaid_transaction_id))); }
          }}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>
              {selectedTxIds.size === sortedTransactions.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {transactions.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setTxSortDropdownVisible(true)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.textSub, fontSize: 12, marginRight: 3 }}>Sort</Text>
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{SORT_LABELS[txSortBy].split(':')[0]}</Text>
            <Text style={{ color: C.textSub, fontSize: 14 }}>▾</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTxFilterDropdownVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: txFilterCategory !== 'all' ? C.accent + '22' : C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: txFilterCategory !== 'all' ? C.accent : C.border }}
          >
            <Text style={{ color: txFilterCategory !== 'all' ? C.accent : C.textSub, fontSize: 12, fontWeight: txFilterCategory !== 'all' ? '700' : '400' }}>
              {txFilterCategory === 'all' ? '⊟ Category' : `⊟ ${PLAID_CATEGORIES.find(c=>c.key===txFilterCategory)?.label || txFilterCategory.replace(/_/g,' ')}`}
            </Text>
          </TouchableOpacity>
          {Object.keys(dbAccountMap).length > 1 && (
            <TouchableOpacity
              onPress={() => setTxFilterAccountVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: txFilterAccount !== 'all' ? C.accent + '22' : C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: txFilterAccount !== 'all' ? C.accent : C.border }}
            >
              <Text style={{ color: txFilterAccount !== 'all' ? C.accent : C.textSub, fontSize: 12, fontWeight: txFilterAccount !== 'all' ? '700' : '400' }}>
                🏦 {txFilterAccount === 'all' ? 'Bank' : 'Filtered'}
              </Text>
            </TouchableOpacity>
          )}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
          renderItem={({ item }) => {
            const itemKey = item.id || item.plaid_transaction_id;
            const isSelected = selectedTxIds.has(itemKey);
            return (
              <TouchableOpacity
                style={[s.txItem, isSelected && { backgroundColor: C.accent + '22', borderRadius: 12 }]}
                onPress={() => {
                  if (bulkSelectMode) {
                    setSelectedTxIds(prev => {
                      const next = new Set(prev);
                      if (next.has(itemKey)) next.delete(itemKey); else next.add(itemKey);
                      return next;
                    });
                  } else {
                    setEditingTx(item);
                    setEditTxFields({ merchant_name: item.merchant_name, amount: String(item.amount), category: getEffectiveCategory(item), transaction_date: item.transaction_date, description: item.description || '' });
                    setRememberCategoryRule(false);
                    setContributeToGoalId(null);
                    setEditTxVisible(true);
                  }
                }}
                onLongPress={() => { setBulkSelectMode(true); setSelectedTxIds(new Set([itemKey])); }}
                activeOpacity={0.75}
              >
                {bulkSelectMode && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? C.accent : C.border, backgroundColor: isSelected ? C.accent : 'transparent', marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
                    {isSelected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                  </View>
                )}
                <CatIcon category={getEffectiveCategory(item)} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txMerchant} numberOfLines={1}>{item.merchant_name || item.description || 'Unknown'}</Text>
                  <Text style={s.txMeta} numberOfLines={1}>
                    {fmtDate(item.transaction_date)} · {PLAID_CATEGORIES.find(c=>c.key===getEffectiveCategory(item))?.label || (getEffectiveCategory(item)||'Other').replace(/_/g,' ')}
                    {dbAccountMap[item.account_id] ? ` · ${dbAccountMap[item.account_id].split(',')[0].trim()}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.txAmt}>-${fmtMoney(item.amount)}</Text>
                  {!bulkSelectMode && <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>tap to edit</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
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
      { key: 'spending_behavior', label: 'Spending Behavior', icon: '◎', color: C.accent },
      { key: 'streak', label: 'Budget Streak', icon: '🔥', color: C.accent },
    ];
    const byType = (type) => goals.filter(g => g.type === type);
    const GoalCard = ({ goal }) => {
      const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
      const typeInfo = GOAL_TYPES.find(t => t.key === goal.type) || { color: C.accent, icon: '★', label: 'Goal' };
      return (
        <View style={{ backgroundColor: C.surface, borderRadius: 16, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: typeInfo.color, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: '#fff' }}>{typeInfo.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{goal.title}</Text>
                {goal.is_completed && <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ color: typeInfo.color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                {typeInfo.label}{goal.update_mode === 'auto' ? ' · Auto-tracked' : ''}
              </Text>
            </View>
            {goal.target_amount > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800', lineHeight: 24 }}>{pct}%</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>done</Text>
              </View>
            )}
          </View>
          {/* Progress */}
          {goal.target_amount > 0 && (
            <>
              <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
                <View style={{ height: 5, width: `${pct}%`, backgroundColor: typeInfo.color, borderRadius: 3 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: C.textSub, fontSize: 12 }}>${fmtMoney(goal.current_amount)} saved</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>${fmtMoney(Math.max(0, goal.target_amount - goal.current_amount))} to go</Text>
              </View>
            </>
          )}
          {/* Streak */}
          {goal.type === 'streak' && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: typeInfo.color + '18', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800' }}>{goal.streak_count || 0}</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>current</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: C.border + '80', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: C.textSub, fontSize: 22, fontWeight: '700' }}>{goal.streak_best || 0}</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>best</Text>
              </View>
            </View>
          )}
          {goal.deadline && <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 10 }}>By {fmtDate(goal.deadline)}</Text>}
          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: typeInfo.color + '18' }}
              onPress={() => {
                setNewGoal({ title: goal.title, target_amount: String(goal.target_amount || ''), current_amount: String(goal.current_amount || ''), deadline: goal.deadline || '', category: goal.category || '' });
                setAddGoalType(goal.type);
                setAddGoalUpdateMode(goal.update_mode || 'manual');
                setAddGoalVisible(true);
              }}
            >
              <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.border }}
              onPress={() => Alert.alert('Delete Goal', `Delete "${goal.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'DELETE' }); fetchGoals(); } }])}
            >
              <Text style={{ color: C.textMuted, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshGoals} tintColor={C.accent} />}
      >
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
            <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setNewGoal({}); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
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
    if (moreSection === 'recurring') return renderRecurringSection();

    const items = [
      { id: 'goals', label: 'Goals', icon: '★', color: C.accent, desc: 'Track savings, debt payoff & streaks' },
      { id: 'groups', label: 'Groups', icon: '◈', color: C.blue, desc: 'Shared budgets & group goals' },
      { id: 'budget', label: 'Budget', icon: '◎', color: C.green, desc: 'Spending limits by category' },
      { id: 'recurring', label: 'Recurring', icon: '↻', color: '#06b6d4', desc: 'Bills, subscriptions & repeating payments' },
      { id: 'networth', label: 'Net Worth', icon: '▲', color: '#1EDFD5', desc: 'Assets minus liabilities', comingSoon: true },
      { id: 'creditscore', label: 'Credit Score', icon: '★', color: '#f97316', desc: 'Monitor your credit health', comingSoon: true },
    ];
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 20, marginTop: 4 }}>More</Text>
        {items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[s.txItem, { paddingVertical: 18, opacity: item.comingSoon ? 0.55 : 1 }]}
            onPress={() => { if (item.comingSoon) { Alert.alert('Coming Soon', `${item.label} is coming in a future update.`); return; } if (item.id === 'groups') { fetchGroups(); } if (item.id === 'recurring') { fetchRecurring(); } setMoreSection(item.id); }}
            activeOpacity={0.75}
          >
            <Icon char={item.icon} color={item.color} size={46} radius={14} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{item.label}</Text>
                {item.comingSoon && <View style={{ backgroundColor: C.surface2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '700' }}>SOON</Text></View>}
              </View>
              <Text style={{ color: C.textSub, fontSize: 12 }}>{item.desc}</Text>
            </View>
            <Text style={{ color: C.textMuted, fontSize: 22 }}>{item.comingSoon ? '' : '›'}</Text>
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
      { key: 'spending_behavior', label: 'Spending Behavior', icon: '◎', color: C.accent, desc: 'Control category spending' },
      { key: 'streak', label: 'Budget Streak', icon: '🔥', color: C.accent, desc: 'Stay under budget daily' },
    ];
    const byType = (type) => goals.filter(g => g.type === type);
    const GoalCard = ({ goal }) => {
      const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
      const typeInfo = GOAL_TYPES.find(t => t.key === goal.type) || { color: C.accent, icon: '★', label: 'Goal' };
      return (
        <View style={{ backgroundColor: C.surface, borderRadius: 16, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: typeInfo.color, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, color: '#fff' }}>{typeInfo.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{goal.title}</Text>
                {goal.is_completed && <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ color: typeInfo.color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                {typeInfo.label}{goal.update_mode === 'auto' ? ' · Auto-tracked' : ''}
              </Text>
            </View>
            {goal.target_amount > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800', lineHeight: 24 }}>{pct}%</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>done</Text>
              </View>
            )}
          </View>
          {goal.target_amount > 0 && (
            <>
              <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
                <View style={{ height: 5, width: `${pct}%`, backgroundColor: typeInfo.color, borderRadius: 3 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: C.textSub, fontSize: 12 }}>${fmtMoney(goal.current_amount)} saved</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>${fmtMoney(Math.max(0, goal.target_amount - goal.current_amount))} to go</Text>
              </View>
            </>
          )}
          {goal.type === 'streak' && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: typeInfo.color + '18', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: typeInfo.color, fontSize: 22, fontWeight: '800' }}>{goal.streak_count || 0}</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>current</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: C.border + '80', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: C.textSub, fontSize: 22, fontWeight: '700' }}>{goal.streak_best || 0}</Text>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>best</Text>
              </View>
            </View>
          )}
          {goal.deadline && <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 10 }}>By {fmtDate(goal.deadline)}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: 'center', backgroundColor: typeInfo.color + '18' }}
              onPress={() => {
                setNewGoal({ title: goal.title, target_amount: String(goal.target_amount || ''), current_amount: String(goal.current_amount || ''), deadline: goal.deadline || '', category: goal.category || '' });
                setAddGoalType(goal.type);
                setAddGoalUpdateMode(goal.update_mode || 'manual');
                setAddGoalVisible(true);
              }}
            >
              <Text style={{ color: typeInfo.color, fontSize: 13, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.border }}
              onPress={() => Alert.alert('Delete Goal', `Delete "${goal.title}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/goals/${goal.id}`, { method: 'DELETE' }); fetchGoals(); } }])}
            >
              <Text style={{ color: C.textMuted, fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshGoals} tintColor={C.accent} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 2, gap: 6 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>My Goals</Text>
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
            <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setNewGoal({}); setAddGoalUpdateMode('manual'); setAddGoalVisible(true); }}>
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
      const start = getPeriodStart(budgetGlobalPeriod, budget.paycycle_start, budget.paycycle_freq);
      return transactions
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === budget.category)
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    };
    const totalBudgeted = budgets.reduce((s, b) => s + parseFloat(b.monthly_limit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + getBudgetSpend2(b), 0);
    const periodLabels = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', paycycle: 'Paycycle' };

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshBudgets} tintColor={C.accent} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 2, gap: 6 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>Budget</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setNewBudgetPeriod(budgetGlobalPeriod); setAddBudgetVisible(true); }}>
            <Text style={s.syncText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {/* Global period selector */}
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14 }}>
          {['weekly','biweekly','monthly','paycycle'].map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setBudgetGlobalPeriod(p)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: budgetGlobalPeriod === p ? C.accent : 'transparent' }}
            >
              <Text style={{ color: budgetGlobalPeriod === p ? '#fff' : C.textSub, fontSize: 12, fontWeight: '700' }}>{periodLabels[p]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {budgets.length > 0 && totalBudgeted > 0 && (
          <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <View>
                <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600' }}>TOTAL SPENT</Text>
                <Text style={{ color: totalSpent > totalBudgeted ? C.red : C.text, fontSize: 26, fontWeight: '800' }}>${fmtMoney(totalSpent)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.textMuted, fontSize: 11 }}>of ${fmtMoney(totalBudgeted)}</Text>
                <Text style={{ color: totalSpent > totalBudgeted ? C.red : C.green, fontSize: 14, fontWeight: '700' }}>
                  {totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0}% used
                </Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${Math.min(100, totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0)}%`, backgroundColor: totalSpent > totalBudgeted ? C.red : C.accent, borderRadius: 3 }} />
            </View>
          </View>
        )}
        {budgets.length === 0 ? (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="$" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No budgets yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set spending limits by category to track where your money goes.</Text>
            <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setNewBudgetPeriod(budgetGlobalPeriod); setAddBudgetVisible(true); }}>
              <Text style={s.btnText}>Create First Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => {
            const spent = getBudgetSpend2(b);
            const limit = parseFloat(b.monthly_limit || 0);
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const barColor = pct >= 100 ? C.red : pct >= 75 ? '#1EDFD5' : C.green;
            const remaining = Math.max(0, limit - spent);
            const catInfo = PLAID_CATEGORIES.find(c => c.key === b.category);
            const catLabel = catInfo?.label || b.category;
            return (
              <View key={b.id} style={{ backgroundColor: C.surface, borderRadius: 14, marginBottom: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: barColor, marginRight: 10 }} />
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{catLabel}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginRight: 10 }}>${fmtMoney(spent)} / ${fmtMoney(limit)}</Text>
                  <Text style={{ color: barColor, fontSize: 13, fontWeight: '800', minWidth: 36, textAlign: 'right' }}>{pct}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                  <View style={{ height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.textMuted, fontSize: 11 }}>
                    {pct >= 100 ? `$${fmtMoney(spent - limit)} over` : `$${fmtMoney(remaining)} left`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <TouchableOpacity onPress={() => { setEditingBudget(b); setNewBudgetCat(b.category); setNewBudgetLimit(String(b.monthly_limit)); setNewBudgetPeriod(budgetGlobalPeriod); setNewBudgetPaycycleStart(b.paycycle_start || ''); setNewBudgetPaycycleFreq(b.paycycle_freq || 'biweekly'); setAddBudgetVisible(true); }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Delete Budget', `Delete ${b.category.replace(/_/g,' ')} budget?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/budgets/${b.id}`, { method: 'DELETE' }); fetchBudgets(); } }])}>
                      <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
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

  const renderRecurringSection = () => {
    const FREQ_LABELS = { monthly: 'Monthly', weekly: 'Weekly', biweekly: 'Every 2 weeks', custom: 'Custom interval' };
    const monthlyTotal = recurringTxs.reduce((s, r) => {
      const amt = parseFloat(r.amount || 0);
      if (r.frequency === 'monthly') return s + amt;
      if (r.frequency === 'weekly') return s + amt * 4.33;
      if (r.frequency === 'biweekly') return s + amt * 2.17;
      if (r.frequency === 'custom' && r.interval_days) return s + amt * (30 / r.interval_days);
      return s;
    }, 0);
    const getNextDate = (r) => {
      const start = new Date(r.start_date || r.created_at || Date.now());
      const today = new Date();
      if (r.frequency === 'monthly') {
        const next = new Date(today.getFullYear(), today.getMonth(), r.day_of_month || start.getDate());
        if (next < today) next.setMonth(next.getMonth() + 1);
        return next;
      }
      const days = r.frequency === 'weekly' ? 7 : r.frequency === 'biweekly' ? 14 : (r.interval_days || 30);
      let d = new Date(start);
      while (d < today) d = new Date(d.getTime() + days * 86400000);
      return d;
    };
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 2, gap: 6 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>Recurring</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setNewRecurring({ name: '', amount: '', category: 'OTHER', frequency: 'monthly', day_of_month: 1, interval_days: 30, start_date: new Date().toISOString().split('T')[0] }); setAddRecurringVisible(true); }}>
            <Text style={s.syncText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {recurringTxs.length > 0 && (
          <View style={{ backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600' }}>MONTHLY TOTAL</Text>
            <Text style={{ color: C.red, fontSize: 26, fontWeight: '800' }}>{fmtCurrency(monthlyTotal)}</Text>
            <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>Estimated per month</Text>
          </View>
        )}

        {recurringTxs.length === 0 ? (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="↻" color={'#06b6d4'} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No recurring transactions</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Add subscriptions, bills, and repeating payments to track your fixed costs.</Text>
            <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setNewRecurring({ name: '', amount: '', category: 'OTHER', frequency: 'monthly', day_of_month: 1, interval_days: 30, start_date: new Date().toISOString().split('T')[0] }); setAddRecurringVisible(true); }}>
              <Text style={s.btnText}>Add First Recurring</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recurringTxs.map(r => {
            const nextDate = getNextDate(r);
            const daysUntil = Math.round((nextDate.getTime() - Date.now()) / 86400000);
            return (
              <View key={r.id} style={{ backgroundColor: C.surface, borderRadius: 14, marginBottom: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <CatIcon category={r.category || 'OTHER'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{r.name}</Text>
                    <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                      {FREQ_LABELS[r.frequency] || r.frequency} · {fmtCurrency(r.amount)}
                    </Text>
                    <Text style={{ color: daysUntil <= 3 ? C.red : daysUntil <= 7 ? '#1EDFD5' : C.textMuted, fontSize: 11, marginTop: 2 }}>
                      Next: {fmtDate(nextDate.toISOString())} ({daysUntil === 0 ? 'today' : `${daysUntil}d`})
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Delete Recurring', `Delete "${r.name}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/recurring/${r.id}`, { method: 'DELETE' }); fetchRecurring(); } }])}
                  >
                    <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 2, gap: 6 }}>
          <TouchableOpacity onPress={() => setMoreSection(null)}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
          </TouchableOpacity>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Net Worth</Text>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 2, gap: 6 }}>
        <TouchableOpacity onPress={() => setMoreSection(null)}>
          <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
        </TouchableOpacity>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>Credit Score</Text>
      </View>
      <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 48 }]}>
        <Icon char="C" color="#06b6d4" size={64} radius={20} />
        <Text style={[s.emptyTitle, { marginTop: 20 }]}>Coming Soon</Text>
        <Text style={[s.emptyText, { marginBottom: 8 }]}>Credit score monitoring will be available in a future update. We'll notify you when it's ready.</Text>
        <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center' }}>Finlit · Powered by secure credit bureau data</Text>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderGroupsSection = () => (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {!currentGroup ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 6, gap: 6 }}>
            <TouchableOpacity onPress={() => setMoreSection(null)}>
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>‹ More</Text>
            </TouchableOpacity>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>/</Text>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>Groups</Text>
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
            <TouchableOpacity onPress={() => { setCurrentGroup(null); setGroupSharedTx([]); setGroupSettingsOpen(false); }}>
              <Text style={{ color: C.accent, fontSize: 14, fontWeight: '600' }}>‹ Groups</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{currentGroup.name}</Text>
            <TouchableOpacity
              onPress={() => setGroupSettingsOpen(o => !o)}
              style={{ backgroundColor: groupSettingsOpen ? C.accent : C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: groupSettingsOpen ? C.accent : C.border }}
            >
              <Text style={{ color: groupSettingsOpen ? '#fff' : C.textSub, fontSize: 13, fontWeight: '700' }}>⚙ Settings</Text>
            </TouchableOpacity>
          </View>

          {/* ── Group Settings Panel ── */}
          {groupSettingsOpen && (
            <View style={[s.section, { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 20 }]}>
              {/* My Sharing */}
              {groupDetail.members.filter(m => m.email === email).map(m => (
                <View key={m.id}>
                  <Text style={[s.sectionTitle, { marginBottom: 10 }]}>My Sharing</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Share Transactions</Text>
                      <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Show the group your transactions</Text>
                    </View>
                    {groupShareLoading ? <ActivityIndicator size="small" color={C.accent} /> : (
                      <Switch value={!!m.share_transactions} onValueChange={async (v) => {
                        setGroupShareLoading(true);
                        await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share_transactions: v, share_accounts: !!m.share_accounts }) });
                        await fetchGroupDetail(currentGroup.id);
                        setGroupShareLoading(false);
                      }} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Share Account Balances</Text>
                      <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>Show the group your balances</Text>
                    </View>
                    {groupShareLoading ? <ActivityIndicator size="small" color={C.accent} /> : (
                      <Switch value={!!m.share_accounts} onValueChange={async (v) => {
                        setGroupShareLoading(true);
                        await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share_transactions: !!m.share_transactions, share_accounts: v }) });
                        await fetchGroupDetail(currentGroup.id);
                        setGroupShareLoading(false);
                      }} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
                    )}
                  </View>
                </View>
              ))}

              {/* Members */}
              <Text style={[s.sectionTitle, { marginBottom: 10 }]}>Members ({groupDetail.members.length})</Text>
              {groupDetail.members.map(m => (
                <View key={m.id} style={[s.txItem, { paddingVertical: 10 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: m.email === email ? C.accent : C.surface2, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: m.email === email ? '#fff' : C.textSub, fontSize: 14, fontWeight: '700' }}>{(m.email?.[0] || '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant}>{m.email === email ? 'You' : m.email?.split('@')[0]}</Text>
                    <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
                      <Text style={{ color: C.textMuted, fontSize: 10, backgroundColor: C.surface2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>{m.role}</Text>
                      {m.share_transactions && <Text style={{ color: C.green, fontSize: 10, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>Txns</Text>}
                      {m.share_accounts && <Text style={{ color: C.blue, fontSize: 10, backgroundColor: 'rgba(59,130,246,0.12)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>Balance</Text>}
                    </View>
                  </View>
                  {m.email !== email && (
                    <TouchableOpacity onPress={() => Alert.alert('Remove Member', `Remove ${m.email} from this group?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, { method: 'DELETE' }); fetchGroupDetail(currentGroup.id); } }])}>
                      <Text style={{ color: C.red, fontSize: 11, fontWeight: '600' }}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Delete Group */}
              <TouchableOpacity
                style={{ marginTop: 16, marginBottom: 4, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: C.red, backgroundColor: 'rgba(239,68,68,0.08)' }}
                onPress={() => Alert.alert('Delete Group', `Delete "${currentGroup.name}" and all its data? This cannot be undone.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/groups/${currentGroup.id}`, { method: 'DELETE' }); setCurrentGroup(null); fetchGroups(); setGroupSettingsOpen(false); } }])}
              >
                <Text style={{ color: C.red, fontWeight: '700', fontSize: 14 }}>Delete Group</Text>
              </TouchableOpacity>

              {/* Invite */}
              <Text style={[s.label, { marginTop: 10 }]}>Invite by Email</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="email@example.com"
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
          )}

          {/* ── Member Balances (if shared) ── */}
          {groupDetail.members.some(m => m.share_accounts && m.total_balance != null) && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Member Balances</Text>
              {groupDetail.members.filter(m => m.share_accounts).map(m => (
                <View key={m.id} style={[s.txItem]}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.blue, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{(m.email?.[0] || '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txMerchant}>{m.email?.split('@')[0]}</Text>
                    <Text style={s.txMeta}>Sharing balances</Text>
                  </View>
                  <Text style={{ color: C.green, fontSize: 15, fontWeight: '700' }}>
                    {m.total_balance != null ? `$${fmtMoney(m.total_balance)}` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Group Feed ── */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={s.sectionTitle}>Group Feed</Text>
              {groupSharedTx.length > 0 && (
                <TouchableOpacity onPress={() => setGroupTxFilterVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: (groupTxFilterCat !== 'all' || groupTxFilterOwner !== 'all') ? C.accent + '22' : C.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: (groupTxFilterCat !== 'all' || groupTxFilterOwner !== 'all') ? C.accent : C.border }}>
                  <Text style={{ color: (groupTxFilterCat !== 'all' || groupTxFilterOwner !== 'all') ? C.accent : C.textSub, fontSize: 12, fontWeight: '600' }}>Filter ▾</Text>
                </TouchableOpacity>
              )}
            </View>
            {groupSharedTx.length === 0 ? (
              <View style={[s.connectCard, { paddingVertical: 20, alignItems: 'center' }]}>
                <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center' }}>
                  No shared activity yet. Members can share their transactions below.
                </Text>
              </View>
            ) : (() => {
              let filtered = [...groupSharedTx];
              if (groupTxFilterCat !== 'all') filtered = filtered.filter(tx => tx.category === groupTxFilterCat);
              if (groupTxFilterOwner !== 'all') filtered = filtered.filter(tx => tx.member_email === groupTxFilterOwner);
              if (groupTxSort === 'amount_desc') filtered.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
              else if (groupTxSort === 'amount_asc') filtered.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
              else filtered.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
              return filtered.slice(0, 30).map((tx, i) => (
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
              ));
            })()}
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

          {/* ── Group Budgets ── */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Group Budget</Text>
              <TouchableOpacity style={s.syncBtn} onPress={() => { setNewGroupBudgetCat(''); setNewGroupBudgetLimit(''); setNewGroupBudgetPeriod('monthly'); setAddGroupBudgetVisible(true); }}>
                <Text style={s.syncText}>+ Budget</Text>
              </TouchableOpacity>
            </View>
            {groupBudgets.length === 0 && <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 8 }}>No group budgets yet. Set shared spending limits for the group.</Text>}
            {groupBudgets.map(b => {
              const catInfo = PLAID_CATEGORIES.find(c => c.key === b.category);
              const catLabel = catInfo?.label || b.category;
              const limit = parseFloat(b.monthly_limit || 0);
              const groupSpent = groupSharedTx
                .filter(tx => tx.category === b.category)
                .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
              const pct = limit > 0 ? Math.min(100, Math.round((groupSpent / limit) * 100)) : 0;
              const barColor = pct >= 100 ? C.red : pct >= 75 ? '#1EDFD5' : C.green;
              const periodLabel = { weekly: 'Weekly', monthly: 'Monthly', biweekly: 'Biweekly' }[b.period || 'monthly'];
              return (
                <View key={b.id} style={{ backgroundColor: C.surface, borderRadius: 14, marginBottom: 10, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: barColor, marginRight: 10 }} />
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{catLabel}</Text>
                    <Text style={{ color: C.textSub, fontSize: 12, marginRight: 8 }}>${fmtMoney(groupSpent)} / ${fmtMoney(limit)}</Text>
                    <Text style={{ color: barColor, fontSize: 13, fontWeight: '800' }}>{pct}%</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                    <View style={{ height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>{periodLabel} · {pct >= 100 ? `$${fmtMoney(groupSpent - limit)} over` : `$${fmtMoney(Math.max(0, limit - groupSpent))} left`}</Text>
                    <TouchableOpacity onPress={() => Alert.alert('Delete Budget', `Delete ${(b.category||'').replace(/_/g,' ')} budget?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/groups/${currentGroup.id}/budgets/${b.id}`, { method: 'DELETE' }); fetchGroupDetail(currentGroup.id); } }])}>
                      <Text style={{ color: C.red, fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
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
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>Share Account Balances</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>
                      {m.share_accounts ? `Sharing ${acctShareSelectedIds.size || 'all'} account(s) · tap to change` : 'Show the group your balances'}
                    </Text>
                  </View>
                  <Switch
                    value={!!m.share_accounts}
                    onValueChange={async (v) => {
                      if (v) {
                        // Open account picker before enabling
                        setAcctShareSelectedIds(new Set(accounts.map(a => a.account_id)));
                        setAcctShareModalVisible(true);
                      } else {
                        await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(m.email)}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ share_transactions: !!m.share_transactions, share_accounts: false }),
                        });
                        fetchGroupDetail(currentGroup.id);
                      }
                    }}
                    trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff"
                  />
                </View>
                {!!m.share_accounts && accounts.length > 0 && (
                  <TouchableOpacity onPress={() => { setAcctShareSelectedIds(new Set(accounts.map(a => a.account_id))); setAcctShareModalVisible(true); }} style={{ marginTop: 6 }}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Change shared accounts →</Text>
                  </TouchableOpacity>
                )}
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
      const start = getPeriodStart(budgetGlobalPeriod, budget.paycycle_start, budget.paycycle_freq);
      return transactions
        .filter(tx => (tx.transaction_date || '') >= start && tx.category === budget.category)
        .reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    };
    const totalBudgeted = budgets.reduce((s, b) => s + parseFloat(b.monthly_limit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + getBudgetSpend(b), 0);
    const bpLabels = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' };

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshBudgets} tintColor={C.accent} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>Budget</Text>
          <TouchableOpacity style={s.syncBtn} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setNewBudgetPeriod(budgetGlobalPeriod); setAddBudgetVisible(true); }}>
            <Text style={s.syncText}>+ Add Budget</Text>
          </TouchableOpacity>
        </View>
        {/* Global period selector */}
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14 }}>
          {['weekly','biweekly','monthly'].map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setBudgetGlobalPeriod(p)}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: budgetGlobalPeriod === p ? C.accent : 'transparent' }}
            >
              <Text style={{ color: budgetGlobalPeriod === p ? '#fff' : C.textSub, fontSize: 13, fontWeight: '700' }}>{bpLabels[p]}</Text>
            </TouchableOpacity>
          ))}
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

        {budgets.length > 0 && totalBudgeted > 0 && (
          <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <View>
                <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600' }}>TOTAL SPENT</Text>
                <Text style={{ color: totalSpent > totalBudgeted ? C.red : C.text, fontSize: 26, fontWeight: '800' }}>${fmtMoney(totalSpent)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.textMuted, fontSize: 11 }}>of ${fmtMoney(totalBudgeted)}</Text>
                <Text style={{ color: totalSpent > totalBudgeted ? C.red : C.green, fontSize: 14, fontWeight: '700' }}>
                  {totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0}% used
                </Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${Math.min(100, totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0)}%`, backgroundColor: totalSpent > totalBudgeted ? C.red : C.accent, borderRadius: 3 }} />
            </View>
          </View>
        )}

        {budgets.length === 0 ? (
          <View style={[s.connectCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <Icon char="$" color={C.accent} size={52} radius={16} />
            <Text style={[s.emptyTitle, { marginTop: 16 }]}>No budgets yet</Text>
            <Text style={[s.emptyText, { marginBottom: 20 }]}>Set spending limits by category to track where your money goes.</Text>
            <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setEditingBudget(null); setNewBudgetCat(''); setNewBudgetLimit(''); setNewBudgetPeriod(budgetGlobalPeriod); setAddBudgetVisible(true); }}>
              <Text style={s.btnText}>Create First Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => {
            const spent = getBudgetSpend(b);
            const limit = parseFloat(b.monthly_limit || 0);
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const barColor = pct >= 100 ? C.red : pct >= 75 ? '#1EDFD5' : C.green;
            const remaining = Math.max(0, limit - spent);
            const catInfo = PLAID_CATEGORIES.find(c => c.key === b.category);
            const catLabel = catInfo?.label || b.category;
            return (
              <View key={b.id} style={{ backgroundColor: C.surface, borderRadius: 14, marginBottom: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: barColor, marginRight: 10 }} />
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{catLabel}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginRight: 10 }}>${fmtMoney(spent)} / ${fmtMoney(limit)}</Text>
                  <Text style={{ color: barColor, fontSize: 13, fontWeight: '800', minWidth: 36, textAlign: 'right' }}>{pct}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                  <View style={{ height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.textMuted, fontSize: 11 }}>
                    {pct >= 100 ? `$${fmtMoney(spent - limit)} over` : `$${fmtMoney(remaining)} left`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 14 }}>
                    <TouchableOpacity onPress={() => { setEditingBudget(b); setNewBudgetCat(b.category); setNewBudgetLimit(String(b.monthly_limit)); setNewBudgetPeriod(budgetGlobalPeriod); setAddBudgetVisible(true); }}>
                      <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Delete Budget', `Delete ${b.category.replace(/_/g,' ')} budget?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await fetch(`${API_URL}/api/budgets/${b.id}`, { method: 'DELETE' }); fetchBudgets(); } }])}>
                      <Text style={{ color: C.red, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
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
      {!isSubscribed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ color: C.textMuted, fontSize: 12 }}>
            <Text style={{ color: C.amber }}>★ Free plan</Text> · {Math.max(0, 6 - aiRequestsUsed)}/6 AI requests left (12h window)
          </Text>
          <TouchableOpacity onPress={() => setUpgradeModalVisible(true)}>
            <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>Upgrade</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={chatMessages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === 'user' ? s.userBubble : s.aiBubble]}>
            {item.role === 'assistant' && (
              <Text style={s.bubbleName}>Finlit</Text>
            )}
            <Text style={[s.bubbleText, item.role === 'user' && { color: '#fff' }]}>{item.text}</Text>
          </View>
        )}
      />
      {loadingChat && (
        <View style={[s.aiBubble, s.bubble, { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={{ color: C.textSub, fontSize: 13 }}>Finlit is thinking…</Text>
        </View>
      )}
      <View style={s.chatBar}>
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          disabled={transcribingVoice}
          style={{ paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isRecording ? C.red : C.surface2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: isRecording ? C.red : C.border }}>
            <Text style={{ fontSize: 16 }}>{isRecording ? '⏹' : '🎙'}</Text>
          </View>
        </TouchableOpacity>
        {isRecording ? (
          <View style={[s.chatInput, { justifyContent: 'center' }]}>
            <Text style={{ color: C.red, fontSize: 14, fontWeight: '600' }}>🎙 Listening...</Text>
          </View>
        ) : transcribingVoice ? (
          <View style={[s.chatInput, { justifyContent: 'center' }]}>
            <Text style={{ color: C.textMuted, fontSize: 14 }}>Transcribing...</Text>
          </View>
        ) : (
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
        )}
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
              onPress={() => {
                if (!isSubscribed) { closeDrawer(); setTimeout(() => setUpgradeModalVisible(true), 300); return; }
                closeDrawer(); setTimeout(openPlaidLink, 300);
              }}
            >
              <Icon char="B" color={C.blue} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.drawerRowText}>Connect Bank</Text>
                  {!isSubscribed && <Text style={{ color: C.amber, fontSize: 11, fontWeight: '700' }}>★ Premium</Text>}
                </View>
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
              <Icon char="N" color={BRAND_BLUE} size={32} />
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
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(() => setCurrencyVisible(true), 300); }}
            >
              <Icon char={currencySymbol[0] || '$'} color={C.green} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Currency</Text>
                <Text style={s.drawerRowSub}>{currency} · {CURRENCIES.find(c => c.code === currency)?.name || 'US Dollar'}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(() => setAutoSyncTimeVisible(true), 300); }}
            >
              <Icon char="⏰" color={BRAND_BLUE} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>Auto Sync</Text>
                <Text style={s.drawerRowSub}>
                  {autoSyncEnabled
                    ? `Daily at ${autoSyncHour === 0 ? '12:00 AM' : autoSyncHour < 12 ? `${autoSyncHour}:00 AM` : autoSyncHour === 12 ? '12:00 PM' : `${autoSyncHour - 12}:00 PM`}`
                    : 'Tap to schedule daily sync'}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Appearance */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Appearance</Text>
            <View style={[s.drawerRow, { paddingVertical: 14 }]}>
              <Icon char={isDarkMode ? '🌙' : '☀'} color={C.accent} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</Text>
                <Text style={s.drawerRowSub}>Tap to switch</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#cbd5e1', true: BRAND_BLUE + '80' }}
                thumbColor={isDarkMode ? BRAND_BLUE : '#94a3b8'}
              />
            </View>
          </View>

          {/* Support */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Support</Text>
            <TouchableOpacity
              style={s.drawerRow}
              onPress={() => { closeDrawer(); setTimeout(() => setHelpVisible(true), 300); }}
            >
              <Icon char="?" color={C.blue} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Help & FAQ</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="★" color={BRAND_BLUE} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Rate Finlit</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Icon char="i" color={C.textSub} size={32} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.drawerRowText}>About</Text>
                <Text style={s.drawerRowSub}>Version 1.0.8</Text>
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

      {/* Upgrade Modal */}
      <Modal visible={upgradeModalVisible} animationType="fade" transparent onRequestClose={() => setUpgradeModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>★</Text>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Finlit Premium</Text>
            <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
              Unlock unlimited AI requests, bank account connection via Plaid, and all premium features.
            </Text>
            <View style={{ width: '100%', gap: 10, marginBottom: 20 }}>
              {[
                '✓ Connect your bank via Plaid',
                '✓ Unlimited AI requests',
                '✓ Real-time transaction sync',
                '✓ Advanced insights & analytics',
              ].map(item => (
                <Text key={item} style={{ color: C.text, fontSize: 14 }}>{item}</Text>
              ))}
            </View>
            <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
              Free plan includes: receipt scanning + AI auto-categorize (6 requests / 12 hours)
            </Text>
            <TouchableOpacity style={s.btn} onPress={() => setUpgradeModalVisible(false)}>
              <Text style={s.btnText}>Coming Soon</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUpgradeModalVisible(false)} style={{ marginTop: 14 }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Account Share Modal */}
      <Modal visible={acctShareModalVisible} animationType="slide" transparent onRequestClose={() => setAcctShareModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Choose Accounts to Share</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 16 }}>Select which accounts to show group members.</Text>
            {accounts.length === 0 && <Text style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>No linked accounts. Connect a bank first.</Text>}
            {accounts.map(acc => {
              const isSelected = acctShareSelectedIds.has(acc.account_id);
              return (
                <TouchableOpacity
                  key={acc.account_id}
                  style={[s.txItem, { marginHorizontal: 0, marginBottom: 8, borderRadius: 12, backgroundColor: isSelected ? C.accent + '18' : C.surface }]}
                  onPress={() => {
                    setAcctShareSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(acc.account_id)) next.delete(acc.account_id); else next.add(acc.account_id);
                      return next;
                    });
                  }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? C.accent : C.border, backgroundColor: isSelected ? C.accent : 'transparent', marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
                    {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{acc.name}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>{acc.subtype} · ${fmtMoney(acc.balances?.current || 0)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[s.btn, { marginTop: 16 }]}
              onPress={async () => {
                const myMember = groupDetail.members.find(m => m.email === email);
                if (myMember) {
                  await fetch(`${API_URL}/api/groups/${currentGroup.id}/members/${encodeURIComponent(myMember.email)}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ share_transactions: !!myMember.share_transactions, share_accounts: acctShareSelectedIds.size > 0 }),
                  });
                  fetchGroupDetail(currentGroup.id);
                }
                setAcctShareModalVisible(false);
              }}
            >
              <Text style={s.btnText}>Confirm ({acctShareSelectedIds.size} accounts)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAcctShareModalVisible(false)} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>Cancel</Text>
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
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>◱  Finlit Bubble</Text>
              <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20 }}>
                A floating AI chat bubble on your Android home screen with quick access to your account balance, recent transactions, and spending insights — powered by the same AI as the app.
              </Text>
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20, marginBottom: 24 }}>
              This feature is available in the next app update. To get it, download the latest version of Finlit from the Play Store once the update is live.
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
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Review Transaction</Text>
              <Text style={s.label}>Merchant / Name</Text>
              <TextInput style={s.input} value={editTxFields.merchant_name} onChangeText={v => setEditTxFields(p => ({...p, merchant_name: v}))} placeholderTextColor={C.textMuted} />
              <Text style={s.label}>Amount ($)</Text>
              <TextInput style={s.input} value={editTxFields.amount} onChangeText={v => setEditTxFields(p => ({...p, amount: v}))} keyboardType="decimal-pad" placeholderTextColor={C.textMuted} />
              {/* Assumed category — shown prominently, full list below to change */}
              <Text style={s.label}>Category</Text>
              {editTxFields.category && (() => {
                const assumed = [...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].find(c => c.key === editTxFields.category);
                return assumed ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.accent + '18', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.accent + '44' }}>
                    <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700', flex: 1 }}>✓ {assumed.icon} {assumed.label}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>Detected — tap below to change</Text>
                  </View>
                ) : null;
              })()}
              <ScrollView style={{ maxHeight: 160, marginBottom: 12, borderWidth: 1, borderColor: C.border, borderRadius: 12 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {[...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].map(cat => (
                  <TouchableOpacity key={cat.key} onPress={() => setEditTxFields(p => ({...p, category: cat.key}))}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: editTxFields.category === cat.key ? C.accent + '18' : 'transparent' }}>
                    <Text style={{ color: editTxFields.category === cat.key ? C.accent : C.text, fontSize: 14, fontWeight: editTxFields.category === cat.key ? '700' : '400' }}>{cat.icon} {cat.label}</Text>
                    {editTxFields.category === cat.key && <Text style={{ color: C.accent, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Remember rule */}
              {editTxFields.merchant_name ? (
                <TouchableOpacity
                  onPress={() => setRememberCategoryRule(p => !p)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: rememberCategoryRule ? C.accent + '22' : C.surface, borderWidth: 1, borderColor: rememberCategoryRule ? C.accent : C.border }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: rememberCategoryRule ? C.accent : C.border, backgroundColor: rememberCategoryRule ? C.accent : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                    {rememberCategoryRule && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>Always categorize <Text style={{ fontWeight: '700' }}>{editTxFields.merchant_name}</Text> as this</Text>
                </TouchableOpacity>
              ) : null}
              {/* Contribute to goal */}
              {goals.filter(g => g.type === 'savings' || g.type === 'debt_payoff').length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.label}>Contribute to Goal (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {[{ id: null, title: 'None' }, ...goals.filter(g => g.type === 'savings' || g.type === 'debt_payoff')].map(g => (
                      <TouchableOpacity key={g.id || 'none'} onPress={() => setContributeToGoalId(g.id)}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: contributeToGoalId === g.id ? C.accent : C.surface, borderWidth: 1, borderColor: contributeToGoalId === g.id ? C.accent : C.border }}>
                        <Text style={{ color: contributeToGoalId === g.id ? '#fff' : C.textSub, fontSize: 12, fontWeight: '600' }}>{g.title || 'None'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Text style={s.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={editTxFields.transaction_date} onChangeText={v => setEditTxFields(p => ({...p, transaction_date: v}))} placeholderTextColor={C.textMuted} />
              <TouchableOpacity
                style={[s.btn, savingTx && s.btnOff]}
                disabled={savingTx}
                onPress={async () => {
                  setSavingTx(true);
                  try {
                    await fetch(`${API_URL}/api/transactions/${editingTx.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editTxFields, amount: parseFloat(editTxFields.amount) }) });
                    // Save category rule if checked
                    if (rememberCategoryRule && editTxFields.merchant_name) {
                      const key = editTxFields.merchant_name.toLowerCase();
                      saveCategoryRules({ ...categoryRules, [key]: editTxFields.category });
                    }
                    // Contribute to goal if selected
                    if (contributeToGoalId) {
                      const goal = goals.find(g => g.id === contributeToGoalId);
                      if (goal) {
                        const newAmt = (goal.current_amount || 0) + parseFloat(editTxFields.amount || 0);
                        await fetch(`${API_URL}/api/goals/${contributeToGoalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_amount: newAmt, is_completed: goal.target_amount > 0 && newAmt >= goal.target_amount }) });
                        fetchGoals();
                      }
                    }
                    setEditTxVisible(false);
                    fetchTransactions();
                  } catch {}
                  finally { setSavingTx(false); }
                }}
              >
                {savingTx ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Changes</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#06b6d4', marginTop: 0 }]}
                onPress={() => {
                  setEditTxVisible(false);
                  setTimeout(() => {
                    setNewRecurring({
                      name: editTxFields.merchant_name || '',
                      amount: String(editTxFields.amount || ''),
                      category: editTxFields.category || 'OTHER',
                      frequency: 'monthly',
                      day_of_month: new Date(editTxFields.transaction_date || Date.now()).getDate(),
                      interval_days: 30,
                      start_date: editTxFields.transaction_date || new Date().toISOString().split('T')[0],
                    });
                    setAddRecurringVisible(true);
                  }, 300);
                }}
              >
                <Text style={s.btnText}>↻ Mark as Recurring</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.linkRow} onPress={() => setEditTxVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Receipt Scan Review Modal */}
      <Modal visible={receiptScanVisible} animationType="slide" transparent onRequestClose={() => setReceiptScanVisible(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Receipt Scanned</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, marginBottom: 14 }}>Review and confirm before saving.</Text>
              {receiptScanError ? <Text style={{ color: BASE.red, fontSize: 13, marginBottom: 8 }}>{receiptScanError}</Text> : null}
              <Text style={s.label}>Merchant</Text>
              <TextInput style={s.input} value={receiptFields.merchant_name} onChangeText={v => setReceiptFields(p => ({...p, merchant_name: v}))} placeholderTextColor={C.textMuted} placeholder="Merchant name" />
              <Text style={s.label}>Amount ($)</Text>
              <TextInput style={s.input} value={receiptFields.amount} onChangeText={v => setReceiptFields(p => ({...p, amount: v}))} keyboardType="decimal-pad" placeholderTextColor={C.textMuted} placeholder="0.00" />
              <Text style={s.label}>Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={receiptFields.transaction_date} onChangeText={v => setReceiptFields(p => ({...p, transaction_date: v}))} placeholderTextColor={C.textMuted} />
              <Text style={s.label}>Category</Text>
              {receiptFields.category && (() => {
                const detected = [...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].find(c => c.key === receiptFields.category);
                return detected ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.accent + '18', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.accent + '44' }}>
                    <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700', flex: 1 }}>✓ {detected.icon} {detected.label}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11 }}>Detected — tap below to change</Text>
                  </View>
                ) : null;
              })()}
              <ScrollView style={{ maxHeight: 160, marginBottom: 12, borderWidth: 1, borderColor: C.border, borderRadius: 12 }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {[...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].map(cat => (
                  <TouchableOpacity key={cat.key} onPress={() => setReceiptFields(p => ({...p, category: cat.key}))}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: receiptFields.category === cat.key ? C.accent + '18' : 'transparent' }}>
                    <Text style={{ color: receiptFields.category === cat.key ? C.accent : C.text, fontSize: 14, fontWeight: receiptFields.category === cat.key ? '700' : '400' }}>{cat.icon} {cat.label}</Text>
                    {receiptFields.category === cat.key && <Text style={{ color: C.accent, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[s.btn, (savingReceipt || !receiptFields.merchant_name || !receiptFields.amount) && s.btnOff]}
                disabled={savingReceipt || !receiptFields.merchant_name || !receiptFields.amount}
                onPress={async () => {
                  setSavingReceipt(true);
                  setReceiptScanError('');
                  try {
                    const res = await fetch(`${API_URL}/api/transactions`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: userId,
                        merchant_name: receiptFields.merchant_name,
                        amount: parseFloat(receiptFields.amount),
                        transaction_date: receiptFields.transaction_date || new Date().toISOString().split('T')[0],
                        category: receiptFields.category || 'GENERAL_MERCHANDISE',
                        description: receiptFields.description || receiptFields.merchant_name,
                        source: 'receipt',
                      }),
                    });
                    if (!res.ok) {
                      const d = await res.json();
                      setReceiptScanError(d.error || 'Failed to save transaction'); return;
                    }
                    setReceiptScanVisible(false);
                    fetchTransactions();
                    Alert.alert('Saved', 'Transaction added from receipt.');
                  } catch { setReceiptScanError('Could not connect to server'); }
                  finally { setSavingReceipt(false); }
                }}
              >
                {savingReceipt ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Transaction</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.linkRow} onPress={() => setReceiptScanVisible(false)}>
                <Text style={s.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
                      <Text style={{ color: C.textSub, fontSize: 12, lineHeight: 18, marginBottom: addGoalType === 'savings' ? 10 : 0 }}>
                        {addGoalType === 'savings' ? 'After each sync, transactions from the linked category are summed and added toward this goal.' : 'Progress is computed from loan/payment transactions after each sync.'}
                      </Text>
                      {addGoalType === 'savings' && (
                        <>
                          <Text style={[s.label, { marginBottom: 6 }]}>Link Category (transactions that count)</Text>
                          <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                            {PLAID_CATEGORIES.map(cat => (
                              <TouchableOpacity key={cat.key} onPress={() => setNewGoal(p => ({...p, category: cat.key}))}
                                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
                                <Text style={{ color: newGoal.category === cat.key ? C.accent : C.text, fontSize: 13 }}>{cat.icon} {cat.label}</Text>
                                {newGoal.category === cat.key && <Text style={{ color: C.accent }}>✓</Text>}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </>
                      )}
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
                  <ScrollView style={{ maxHeight: 200, marginBottom: 10 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    {[...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].map(cat => (
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
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="+ New category name…"
                      placeholderTextColor={C.textMuted}
                      value={newCatInput}
                      onChangeText={setNewCatInput}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' }}
                      onPress={() => {
                        const cat = newCatInput.trim();
                        if (!cat) return;
                        const updated = [...customCategories.filter(c => c !== cat), cat];
                        setCustomCategories(updated);
                        AsyncStorage.setItem('customCategories', JSON.stringify(updated));
                        setNewBudgetCat(cat);
                        setNewCatInput('');
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {editingBudget && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
                  <CatIcon category={editingBudget.category} />
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{PLAID_CATEGORIES.find(c => c.key === editingBudget.category)?.label || editingBudget.category}</Text>
                </View>
              )}

              {/* Period is auto-set from the active budget tab */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, backgroundColor: C.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>Period:</Text>
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{newBudgetPeriod}</Text>
                <Text style={{ color: C.textMuted, fontSize: 11, flex: 1 }}>(from active tab)</Text>
              </View>
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
                    let saveRes;
                    if (editingBudget) {
                      saveRes = await fetch(`${API_URL}/api/budgets/${editingBudget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthly_limit: parseFloat(newBudgetLimit), period: newBudgetPeriod, ...paycycleData }) });
                    } else {
                      saveRes = await fetch(`${API_URL}/api/budgets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, category: newBudgetCat.trim(), monthly_limit: parseFloat(newBudgetLimit), period: newBudgetPeriod, ...paycycleData }) });
                    }
                    if (!saveRes.ok) {
                      const errData = await saveRes.json().catch(() => ({}));
                      Alert.alert('Error', errData.error || 'Failed to save budget. Please try again.'); return;
                    }
                    setAddBudgetVisible(false);
                    setEditingBudget(null);
                    fetchBudgets();
                  } catch { Alert.alert('Error', 'Could not connect to server.'); }
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

      {/* Add Group Budget Modal */}
      <Modal visible={addGroupBudgetVisible} animationType="slide" transparent onRequestClose={() => setAddGroupBudgetVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>New Group Budget</Text>
            <Text style={s.label}>Category</Text>
            <ScrollView style={{ maxHeight: 140, marginBottom: 14, borderWidth: 1, borderColor: C.border, borderRadius: 10 }} showsVerticalScrollIndicator={false}>
              {[...PLAID_CATEGORIES, ...customCategories.map(c => ({ key: c, label: c, icon: '★' }))].map(c => (
                <TouchableOpacity key={c.key} onPress={() => setNewGroupBudgetCat(c.key)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: newGroupBudgetCat === c.key ? C.accent : C.text, fontSize: 14 }}>{c.icon} {c.label}</Text>
                  {newGroupBudgetCat === c.key && <Text style={{ color: C.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>Spending Limit ($)</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textMuted} value={newGroupBudgetLimit} onChangeText={setNewGroupBudgetLimit} />
            <Text style={s.label}>Period</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {['weekly','monthly'].map(p => (
                <TouchableOpacity key={p} onPress={() => setNewGroupBudgetPeriod(p)} style={{ flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: newGroupBudgetPeriod === p ? C.accent : C.surface2, borderWidth: 1, borderColor: newGroupBudgetPeriod === p ? C.accent : C.border }}>
                  <Text style={{ color: newGroupBudgetPeriod === p ? '#fff' : C.textSub, fontWeight: '600', textTransform: 'capitalize' }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.btn, (!newGroupBudgetCat || !newGroupBudgetLimit) && s.btnOff]}
              disabled={!newGroupBudgetCat || !newGroupBudgetLimit}
              onPress={async () => {
                try {
                  await fetch(`${API_URL}/api/groups/${currentGroup.id}/budgets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: newGroupBudgetCat, monthly_limit: parseFloat(newGroupBudgetLimit), period: newGroupBudgetPeriod, created_by: email }) });
                  setAddGroupBudgetVisible(false);
                  fetchGroupDetail(currentGroup.id);
                } catch {}
              }}
            >
              <Text style={s.btnText}>Create Group Budget</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.linkRow} onPress={() => setAddGroupBudgetVisible(false)}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
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

      {/* Transaction Account Filter Dropdown Modal */}
      <Modal visible={txFilterAccountVisible} animationType="fade" transparent onRequestClose={() => setTxFilterAccountVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setTxFilterAccountVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Filter by Account</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {[['all', 'All Accounts'], ...Object.entries(dbAccountMap)].map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  onPress={() => { setTxFilterAccount(id); setTxFilterAccountVisible(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}
                >
                  <Text style={{ color: txFilterAccount === id ? C.accent : C.text, fontSize: 15, fontWeight: txFilterAccount === id ? '700' : '400' }}>
                    {id === 'all' ? 'All Accounts' : label}
                  </Text>
                  {txFilterAccount === id && <Text style={{ color: C.accent, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.linkRow, { marginTop: 4 }]} onPress={() => setTxFilterAccountVisible(false)}>
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

      {/* Group Transaction Filter Modal */}
      <Modal visible={groupTxFilterVisible} animationType="fade" transparent onRequestClose={() => setGroupTxFilterVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setGroupTxFilterVisible(false)}>
          <View style={[s.modalCard, { paddingBottom: 8 }]}>
            <Text style={s.modalTitle}>Filter Group Feed</Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginBottom: 8 }}>Sort by</Text>
            {[['date_desc','Newest First'],['amount_desc','Highest Amount'],['amount_asc','Lowest Amount']].map(([key, label]) => (
              <TouchableOpacity key={key} onPress={() => setGroupTxSort(key)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: groupTxSort === key ? C.accent : C.text, fontSize: 14, fontWeight: groupTxSort === key ? '700' : '400' }}>{label}</Text>
                {groupTxSort === key && <Text style={{ color: C.accent }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 14, marginBottom: 8 }}>Category</Text>
            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              {[['all','All Categories'], ...Array.from(new Set(groupSharedTx.map(tx => tx.category).filter(Boolean))).sort().map(c => [c, c.replace(/_/g,' ')])].map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setGroupTxFilterCat(key)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: groupTxFilterCat === key ? C.accent : C.text, fontSize: 14, fontWeight: groupTxFilterCat === key ? '700' : '400' }}>{label}</Text>
                  {groupTxFilterCat === key && <Text style={{ color: C.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 14, marginBottom: 8 }}>Member</Text>
            <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
              {[['all','All Members'], ...Array.from(new Set(groupSharedTx.map(tx => tx.member_email).filter(Boolean))).map(e => [e, e.split('@')[0]])].map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setGroupTxFilterOwner(key)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: groupTxFilterOwner === key ? C.accent : C.text, fontSize: 14, fontWeight: groupTxFilterOwner === key ? '700' : '400' }}>{label}</Text>
                  {groupTxFilterOwner === key && <Text style={{ color: C.accent }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.linkRow, { marginTop: 8 }]} onPress={() => { setGroupTxFilterCat('all'); setGroupTxFilterOwner('all'); setGroupTxSort('date_desc'); setGroupTxFilterVisible(false); }}>
              <Text style={{ color: C.red, fontSize: 13 }}>Reset Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.linkRow, { marginTop: 0 }]} onPress={() => setGroupTxFilterVisible(false)}>
              <Text style={s.linkText}>Done</Text>
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

      {/* Currency Modal */}
      <Modal visible={currencyVisible} animationType="slide" transparent onRequestClose={() => setCurrencyVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Select Currency</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 16 }}>All amounts will display in your selected currency.</Text>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c.code}
                onPress={() => {
                  setCurrency(c.code);
                  AsyncStorage.setItem('currency', c.code);
                  setCurrencyVisible(false);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: currency === c.code ? C.accent : C.surface2, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                  <Text style={{ color: currency === c.code ? '#fff' : C.textSub, fontSize: 16, fontWeight: '700' }}>{c.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: currency === c.code ? '700' : '400' }}>{c.name}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{c.code}</Text>
                </View>
                {currency === c.code && <Text style={{ color: C.accent, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.linkRow, { marginTop: 8 }]} onPress={() => setCurrencyVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help & FAQ Modal */}
      <Modal visible={helpVisible} animationType="slide" transparent onRequestClose={() => setHelpVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '85%' }]}>
            <Text style={s.modalTitle}>Help & FAQ</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { q: 'How do I connect my bank?', a: 'Tap the ⚙ gear icon → Connect Bank. This is a Premium feature that uses Plaid to securely link your accounts.' },
                { q: 'How does the AI work?', a: 'The AI uses your real transaction history to answer financial questions. Free users get 6 requests per 12 hours; Premium is unlimited.' },
                { q: 'Why are some transactions income?', a: 'Finlit automatically excludes income (payroll, transfers in) from spending totals. You can verify categories in the Transactions tab.' },
                { q: 'How is payday detected?', a: 'The app analyzes patterns in your income transactions to estimate when your next payday is. It appears as a banner on the Home tab.' },
                { q: 'What is the Paycycle budget period?', a: 'Paycycle resets your budget tracking at the start of each pay period, so your limits match your actual income cycle.' },
                { q: 'How does auto sync work?', a: 'Set a daily sync time in Settings → Auto Sync. The app syncs once per day at that hour. There is a 23-hour lockout to prevent abuse.' },
                { q: 'How do I export transactions?', a: 'In the Transactions tab, tap ↓ CSV. The app creates a real CSV file and lets you save or share it.' },
                { q: 'Can I use voice to talk to the AI?', a: 'Yes! Tap the 🎙 microphone button in the AI chat. Speak your question and it will be transcribed automatically.' },
                { q: 'What are Recurring Transactions?', a: 'Under More → Recurring, you can track bills and subscriptions. You can also mark any transaction as recurring from its edit screen.' },
                { q: 'How do Groups work?', a: 'Groups let you share transactions and budgets with family or roommates. Each member controls what they share.' },
              ].map((item, i) => (
                <View key={i} style={{ marginBottom: 18 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 6 }}>Q: {item.q}</Text>
                  <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20 }}>{item.a}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Still need help?</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>addga04@gmail.com</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>We typically respond within 24 hours.</Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={s.btn} onPress={() => setHelpVisible(false)}>
              <Text style={s.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Auto Sync Time Picker Modal */}
      <Modal visible={autoSyncTimeVisible} animationType="slide" transparent onRequestClose={() => setAutoSyncTimeVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Auto Sync Schedule</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 16 }}>
              Transactions sync automatically once per day at your chosen hour. You cannot manually re-sync within 23 hours of the last auto-sync.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>Enable Auto Sync</Text>
              <Switch
                value={autoSyncEnabled}
                onValueChange={v => { setAutoSyncEnabled(v); AsyncStorage.setItem('autoSyncEnabled', String(v)); }}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            {autoSyncEnabled && (
              <>
                <Text style={[s.label, { marginBottom: 10 }]}>Sync Hour</Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const label = h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => { setAutoSyncHour(h); AsyncStorage.setItem('autoSyncHour', String(h)); }}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
                      >
                        <Text style={{ color: autoSyncHour === h ? C.accent : C.text, fontSize: 15, fontWeight: autoSyncHour === h ? '700' : '400' }}>{label}</Text>
                        {autoSyncHour === h && <Text style={{ color: C.accent }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {lastSyncTime ? (
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 12 }}>
                Last sync: {new Date(lastSyncTime).toLocaleString()}
              </Text>
            ) : null}
            <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => setAutoSyncTimeVisible(false)}>
              <Text style={s.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Recurring Transaction Modal */}
      <Modal visible={addRecurringVisible} animationType="slide" transparent onRequestClose={() => setAddRecurringVisible(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Add Recurring</Text>
              <Text style={s.label}>Name</Text>
              <TextInput style={s.input} placeholder="e.g. Netflix, Rent, Car Payment" placeholderTextColor={C.textMuted} value={newRecurring.name} onChangeText={v => setNewRecurring(p => ({ ...p, name: v }))} />
              <Text style={s.label}>Amount ($)</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textMuted} value={newRecurring.amount} onChangeText={v => setNewRecurring(p => ({ ...p, amount: v }))} />
              <Text style={s.label}>Frequency</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                {[['monthly','Monthly'],['weekly','Weekly'],['biweekly','Biweekly'],['custom','Custom']].map(([k, l]) => (
                  <TouchableOpacity key={k} onPress={() => setNewRecurring(p => ({ ...p, frequency: k }))} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: newRecurring.frequency === k ? C.accent : C.surface, borderWidth: 1, borderColor: newRecurring.frequency === k ? C.accent : C.border }}>
                    <Text style={{ color: newRecurring.frequency === k ? '#fff' : C.textSub, fontSize: 12, fontWeight: '600' }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {newRecurring.frequency === 'monthly' && (
                <>
                  <Text style={s.label}>Day of Month</Text>
                  <TextInput style={s.input} keyboardType="number-pad" placeholder="1-28" placeholderTextColor={C.textMuted} value={String(newRecurring.day_of_month)} onChangeText={v => setNewRecurring(p => ({ ...p, day_of_month: parseInt(v) || 1 }))} />
                </>
              )}
              {newRecurring.frequency === 'custom' && (
                <>
                  <Text style={s.label}>Every X Days</Text>
                  <TextInput style={s.input} keyboardType="number-pad" placeholder="e.g. 7, 14, 30" placeholderTextColor={C.textMuted} value={String(newRecurring.interval_days)} onChangeText={v => setNewRecurring(p => ({ ...p, interval_days: parseInt(v) || 7 }))} />
                </>
              )}
              <Text style={s.label}>Start Date (YYYY-MM-DD)</Text>
              <TextInput style={s.input} placeholder={new Date().toISOString().split('T')[0]} placeholderTextColor={C.textMuted} value={newRecurring.start_date} onChangeText={v => setNewRecurring(p => ({ ...p, start_date: v }))} />
              <TouchableOpacity
                style={[s.btn, !newRecurring.name.trim() && s.btnOff]}
                disabled={!newRecurring.name.trim()}
                onPress={async () => {
                  try {
                    await fetch(`${API_URL}/api/recurring`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: userId, ...newRecurring, amount: parseFloat(newRecurring.amount) || 0 }),
                    });
                    setAddRecurringVisible(false);
                    fetchRecurring();
                  } catch {}
                }}
              >
                <Text style={s.btnText}>Add Recurring</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.linkRow} onPress={() => setAddRecurringVisible(false)}>
                <Text style={s.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Payday Setup Modal */}
      <Modal visible={paydayModalVisible} animationType="slide" transparent onRequestClose={() => setPaydayModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Set Your Payday</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 18 }}>This tells Finlit when your pay cycle resets for paycycle budgets.</Text>
            <Text style={s.label}>Next Payday Date</Text>
            <TextInput
              style={[s.input, { marginBottom: 18 }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textMuted}
              value={paydayNextDate}
              onChangeText={setPaydayNextDate}
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={s.label}>Pay Frequency</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
              {[['weekly','Weekly'],['biweekly','Every 2 Wks'],['monthly','Monthly']].map(([k, l]) => (
                <TouchableOpacity key={k}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: paydayFreq === k ? C.accent : C.surface, borderWidth: 1, borderColor: paydayFreq === k ? C.accent : C.border }}
                  onPress={() => setPaydayFreq(k)}
                >
                  <Text style={{ color: paydayFreq === k ? '#fff' : C.textSub, fontWeight: '600', fontSize: 12 }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.btn} onPress={() => {
              if (!paydayNextDate || !/^\d{4}-\d{2}-\d{2}$/.test(paydayNextDate)) {
                Alert.alert('Invalid Date', 'Enter your next payday in YYYY-MM-DD format (e.g. 2026-06-01).');
                return;
              }
              const pd = { nextDate: paydayNextDate, frequency: paydayFreq };
              setUserPayday(pd);
              AsyncStorage.setItem('userPayday', JSON.stringify(pd));
              setPaydayModalVisible(false);
            }}>
              <Text style={s.btnText}>Save Payday</Text>
            </TouchableOpacity>
            {userPayday && (
              <TouchableOpacity style={s.linkRow} onPress={() => { setUserPayday(null); AsyncStorage.removeItem('userPayday'); setPaydayModalVisible(false); }}>
                <Text style={[s.linkText, { color: C.red }]}>Clear Payday</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.linkRow} onPress={() => setPaydayModalVisible(false)}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post-Sync Transaction Review Modal */}
      <Modal visible={postSyncVisible} animationType="slide" transparent onRequestClose={() => setPostSyncVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {postSyncTxs.length > 0 && (() => {
              const tx = postSyncTxs[postSyncIdx];
              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={s.modalTitle}>Review Transaction</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>{postSyncIdx + 1} / {postSyncTxs.length}</Text>
                  </View>
                  <Text style={{ color: C.textSub, fontSize: 12, marginBottom: 16 }}>Confirm or correct the category for each new transaction.</Text>
                  <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{tx.merchant_name || tx.description || 'Unknown'}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{fmtDate(tx.transaction_date)} · ${fmtMoney(tx.amount)}</Text>
                  </View>
                  <Text style={s.label}>Category</Text>
                  <ScrollView style={{ maxHeight: 180, marginBottom: 16 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    {PLAID_CATEGORIES.map(cat => (
                      <TouchableOpacity key={cat.key} onPress={() => setPostSyncCat(cat.key)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 3, backgroundColor: postSyncCat === cat.key ? C.accent : C.surface, borderWidth: 1, borderColor: postSyncCat === cat.key ? C.accent : C.border }}>
                        <Text style={{ color: postSyncCat === cat.key ? '#fff' : C.textSub, fontSize: 13, fontWeight: '700', width: 22 }}>{cat.icon}</Text>
                        <Text style={{ color: postSyncCat === cat.key ? '#fff' : C.text, fontSize: 13, flex: 1 }}>{cat.label}</Text>
                        {postSyncCat === cat.key && <Text style={{ color: '#fff' }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}
                      onPress={() => {
                        const next = postSyncIdx + 1;
                        if (next >= postSyncTxs.length) { setPostSyncVisible(false); }
                        else { setPostSyncIdx(next); setPostSyncCat(getEffectiveCategory(postSyncTxs[next])); }
                      }}>
                      <Text style={{ color: C.text, fontWeight: '600' }}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, { flex: 1 }]}
                      onPress={async () => {
                        if (postSyncCat && postSyncCat !== getEffectiveCategory(tx)) {
                          const merchant = (tx.merchant_name || tx.description || '').toLowerCase();
                          const updated = { ...categoryRules, [merchant]: postSyncCat };
                          saveCategoryRules(updated);
                          if (tx.id) await fetch(`${API_URL}/api/transactions/${tx.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: postSyncCat }) });
                        }
                        const next = postSyncIdx + 1;
                        if (next >= postSyncTxs.length) { setPostSyncVisible(false); }
                        else { setPostSyncIdx(next); setPostSyncCat(getEffectiveCategory(postSyncTxs[next])); }
                      }}>
                      <Text style={s.btnText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
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

  balanceCard: { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18, marginBottom: 12, marginTop: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  balanceLabel: { color: C.textSub, fontSize: 11, fontWeight: '700', marginBottom: 6, letterSpacing: 0.6 },
  balanceAmt: { fontSize: 36, fontWeight: '800', color: C.text, marginBottom: 4 },
  balanceSub: { color: C.textMuted, fontSize: 12 },

  acctPill: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, marginRight: 8 },
  acctPillActive: { backgroundColor: C.accent, borderColor: C.accent },
  acctPillText: { color: C.textSub, fontSize: 12, fontWeight: '600' },

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
