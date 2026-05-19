import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, FlatList, ActivityIndicator,
  Animated, Dimensions, Switch, StatusBar, Modal,
} from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');
const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

function deriveSurfaces(bg) {
  // Parse hex and brighten for surface layers
  const n = parseInt(bg.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lift1 = (v) => Math.min(255, v + 20);
  const lift2 = (v) => Math.min(255, v + 35);
  const lift3 = (v) => Math.min(255, v + 55);
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
  textSub: '#7b93b8',
  textMuted: '#354e70',
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
];
const ACCENT_OPTIONS = ['#7c3aed','#3b82f6','#10b981','#ef4444','#f59e0b','#ec4899','#06b6d4','#f97316'];

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const CAT_LETTERS = {
  Groceries: 'G', 'Food and Drink': 'F', Food: 'F', Restaurants: 'R',
  Gas: 'G', Transportation: 'T', Travel: 'T', Shopping: 'S',
  Entertainment: 'E', Subscriptions: 'S', Utilities: 'U',
  Health: 'H', Healthcare: 'H', Other: 'O',
};

const CAT_BG = {
  Groceries: '#059669', 'Food and Drink': '#d97706', Food: '#d97706',
  Restaurants: '#d97706', Gas: '#2563eb', Transportation: '#2563eb',
  Travel: '#7c3aed', Shopping: '#db2777', Entertainment: '#dc2626',
  Subscriptions: '#0891b2', Utilities: '#65a30d', Health: '#059669',
  Healthcare: '#059669', Other: '#475569',
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
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Settings
  const [notifs, setNotifs] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  // Edit profile
  const [editProfileVisible, setEditProfileVisible] = useState(false);

  // Customize theme
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ── Theme ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet(['themeBg', 'themeAccent']).then(pairs => {
      if (pairs[0][1]) setThemeBg(pairs[0][1]);
      if (pairs[1][1]) setThemeAccent(pairs[1][1]);
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
      // Get name from login response (users table) or user_metadata
      const name = data.full_name || data.session.user.user_metadata?.full_name || '';
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(name ? name.split(' ')[0] : email.split('@')[0]);
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
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); return; }
      const uid = data.user.id;
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(firstName.trim());
      setPassword(''); setFirstName(''); setLastName('');
      setDashboardLoading(true);
      try {
        const s = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (s.ok) setDashboardData(await s.json());
      } catch { setDashboardData({ monthly_spending: 0, top_categories: [] }); }
      setScreen('dashboard');
      setDashboardLoading(false);
      // ✅ ADDED THESE TWO LINES:
      fetchAccounts(uid);
      fetchTransactions(uid);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => {
      setScreen('login'); setUserId(null); userIdRef.current = null;
      setEmail(''); setPassword(''); setFirstName(''); setLastName('');
      setDisplayName(''); setError('');
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
        else setSyncError('');
        await fetchTransactions();
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
    const fullName = `${editFirst.trim()} ${editLast.trim()}`.trim();
    try {
      const res = await fetch(`${API_URL}/api/auth/profile/${userIdRef.current}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setDisplayName(editFirst.trim());
      setEditProfileVisible(false);
    } catch { setProfileError('Could not save. Try again.'); }
    finally { setSavingProfile(false); }
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
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: msg }),
      });
      const data = await res.json();
      setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: data.response || 'Sorry, I had trouble with that.' }]);
    } catch {
      setChatMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Connection error. Please try again.' }]);
    } finally { setLoadingChat(false); }
  };

  // ── Insight helpers ─────────────────────────────────
  const getCatData = () => {
    if (!transactions.length) return null;
    const m = {};
    transactions.forEach(tx => { const c = tx.category || 'Other'; m[c] = (m[c] || 0) + parseFloat(tx.amount || 0); });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 5);
  };

  const getWeeklyData = () => {
    const weeks = [0, 0, 0, 0];
    const now = Date.now();
    transactions.forEach(tx => {
      const days = Math.floor((now - new Date(tx.transaction_date || tx.date)) / 86400000);
      const w = Math.min(3, Math.floor(days / 7));
      weeks[3 - w] += parseFloat(tx.amount || 0);
    });
    return weeks;
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
    const catData = getCatData();
    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>
            {selectedAccount ? selectedAccount.name : 'Total Balance'}
          </Text>
          <Text style={s.balanceAmt}>
            ${fmtMoney(selectedAccount?.balances?.current || 0)}
          </Text>
          <Text style={s.balanceSub}>
            {selectedAccount
              ? `${selectedAccount.subtype} · ${selectedAccount.type}`
              : 'Connect a bank to get started'}
          </Text>
        </View>

        {/* Account selector */}
        {accounts.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Accounts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.account_id}
                  style={[s.chip, selectedAccount?.account_id === acc.account_id && s.chipActive]}
                  onPress={() => setSelectedAccount(acc)}
                >
                  <Text style={[s.chipTitle, selectedAccount?.account_id === acc.account_id && s.chipTitleActive]}>
                    {acc.name}
                  </Text>
                  <Text style={[s.chipSub, selectedAccount?.account_id === acc.account_id && { color: 'rgba(255,255,255,0.65)' }]}>
                    ${fmtMoney(acc.balances?.current || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bank reconnect prompt */}
        {accountsError && (
          <View style={s.reconnectCard}>
            <Text style={s.reconnectTitle}>Bank connection needs refresh</Text>
            <Text style={s.reconnectText}>Your bank connection has expired or needs to be re-linked.</Text>
            <TouchableOpacity
              style={[s.btn, { marginBottom: 0 }]}
              onPress={() => { openDrawer(); }}
            >
              <Text style={s.btnText}>Reconnect Bank</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Monthly Spend</Text>
            <Text style={s.statVal}>${fmtMoney(dashboardData?.monthly_spending || 0)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Transactions</Text>
            <Text style={s.statVal}>{transactions.length}</Text>
          </View>
        </View>

        {/* Refresh button */}
        {(loadingAccounts || loadingTx) ? (
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <ActivityIndicator color={C.accent} />
            <Text style={[s.subText, { marginTop: 8 }]}>Refreshing data...</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.refreshBtn} onPress={refreshAll}>
            <Text style={s.refreshText}>↺  Refresh Data</Text>
          </TouchableOpacity>
        )}

        {/* Top spending */}
        {catData && catData.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Top Spending</Text>
            {catData.map(([cat, amt], i) => (
              <View key={cat} style={s.catRow}>
                <View style={s.catInfo}>
                  <Text style={s.catName}>{cat}</Text>
                  <Text style={s.catAmt}>${fmtMoney(amt)}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.bar, { width: `${(amt / catData[0][1]) * 100}%`, backgroundColor: CAT_COLORS[i] }]} />
                </View>
              </View>
            ))}
          </View>
        )}

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

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════════════
  // INSIGHTS TAB
  // ════════════════════════════════════════════════════
  const renderInsights = () => {
    const catData = getCatData();
    const weeklyData = getWeeklyData();
    const total = transactions.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    const avg = transactions.length ? total / transactions.length : 0;

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
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Total Spent</Text>
            <Text style={s.statVal}>${fmtMoney(total)}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>Avg Transaction</Text>
            <Text style={s.statVal}>${fmtMoney(avg)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Weekly Spending</Text>
          <View style={s.chartCard}>
            <LineChart
              data={{
                labels: ['3 wks', '2 wks', 'Last wk', 'This wk'],
                datasets: [{ data: weeklyData.map(v => Math.max(0.01, v)) }],
              }}
              width={SW - 64}
              height={160}
              chartConfig={CHART_CFG}
              bezier
              style={{ borderRadius: 10, marginLeft: -8 }}
              withInnerLines={false}
            />
          </View>
        </View>

        {catData && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Spending by Category</Text>
            {catData.map(([cat, amt], i) => {
              const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
              return (
                <View key={cat} style={s.insightCard}>
                  <View style={[s.insightDot, { backgroundColor: CAT_COLORS[i] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={s.catInfo}>
                      <Text style={s.catName}>{cat}</Text>
                      <Text style={s.catAmt}>${fmtMoney(amt)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.bar, { width: `${pct}%`, backgroundColor: CAT_COLORS[i] }]} />
                    </View>
                  </View>
                  <Text style={[s.pct, { color: CAT_COLORS[i] }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {catData && catData[0] && (
          <View style={[s.highlightCard, { borderColor: CAT_COLORS[0] }]}>
            <Text style={s.highlightLabel}>Biggest Category</Text>
            <Text style={s.highlightValue}>{catData[0][0]}</Text>
            <Text style={s.highlightSub}>
              ${fmtMoney(catData[0][1])} · {Math.round((catData[0][1] / total) * 100)}% of spending
            </Text>
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
          data={transactions}
          keyExtractor={(item, i) => item.id?.toString() || item.plaid_transaction_id || i.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.txItem}>
              <CatIcon category={item.category} />
              <View style={{ flex: 1 }}>
                <Text style={s.txMerchant} numberOfLines={1}>
                  {item.merchant_name || item.description || 'Unknown'}
                </Text>
                <Text style={s.txMeta}>
                  {fmtDate(item.transaction_date)} · {item.category || 'Other'}
                </Text>
              </View>
              <Text style={s.txAmt}>-${fmtMoney(item.amount)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );

  // ════════════════════════════════════════════════════
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
              <Icon char="N" color={C.amber} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Notifications</Text>
              <Switch value={notifs} onValueChange={setNotifs} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
            </View>
            <View style={s.drawerRow}>
              <Icon char="ID" color={C.green} size={32} />
              <Text style={[s.drawerRowText, { flex: 1, marginLeft: 12 }]}>Face ID / Biometrics</Text>
              <Switch value={biometrics} onValueChange={setBiometrics} trackColor={{ false: C.border, true: C.accent }} thumbColor="#fff" />
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
          <View style={s.menuLine} />
          <View style={[s.menuLine, { width: 18 }]} />
          <View style={[s.menuLine, { width: 22 }]} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'chat' && renderChat()}
      </View>

      <View style={s.bottomNav}>
        {[
          { id: 'dashboard', label: 'Home', icon: '⌂' },
          { id: 'insights', label: 'Insights', icon: '◈' },
          { id: 'transactions', label: 'Transactions', icon: '≡' },
          { id: 'chat', label: 'AI Chat', icon: '✦' },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={s.navTab} onPress={() => setActiveTab(tab.id)}>
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

  bottomNav: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 28, paddingTop: 10 },
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
