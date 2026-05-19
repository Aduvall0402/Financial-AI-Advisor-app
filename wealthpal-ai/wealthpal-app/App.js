import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, FlatList, ActivityIndicator,
  Animated, Dimensions, Switch, StatusBar,
} from 'react-native';
import { create, open } from 'react-native-plaid-link-sdk';
import { LineChart } from 'react-native-chart-kit';

const { width: SW } = Dimensions.get('window');
const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

const C = {
  bg: '#060c17',
  surface: '#0c1526',
  surface2: '#111f35',
  border: '#1a2e4a',
  accent: '#7c3aed',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  text: '#eef2ff',
  textSub: '#7b93b8',
  textMuted: '#354e70',
};

const CHART_CFG = {
  backgroundColor: '#0c1526',
  backgroundGradientFrom: '#0c1526',
  backgroundGradientTo: '#0c1526',
  decimalPlaces: 0,
  color: (o = 1) => `rgba(124,58,237,${o})`,
  labelColor: () => C.textSub,
  propsForDots: { r: '4', strokeWidth: '2', stroke: C.accent },
  propsForBackgroundLines: { stroke: C.border },
};

function getCategoryEmoji(cat) {
  const m = {
    Groceries: '🛒', Food: '🍔', Restaurants: '🍽️', 'Food and Drink': '🍔',
    Gas: '⛽', Transportation: '🚗', Travel: '✈️', Shopping: '🛍️',
    Entertainment: '🎬', Subscriptions: '📱', Utilities: '💡',
    Health: '🏥', Healthcare: '🏥', Other: '💳',
  };
  return m[cat] || '💳';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CAT_COLORS = [C.accent, C.blue, C.green, C.amber, C.red];

export default function App() {
  // Splash
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.85)).current;

  // Auth
  const [screen, setScreen] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  // Settings
  const [notifs, setNotifs] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  // ── Splash ──────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(splashOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(splashScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(splashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowSplash(false));
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
  const getName = (name, em) => (name ? name.split(' ')[0] : (em ? em.split('@')[0] : 'there'));

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
      const name = data.session.user.user_metadata?.full_name || '';
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(getName(name, email));
      setPassword('');
      setDashboardLoading(true);
      try {
        const s = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (s.ok) setDashboardData(await s.json());
      } catch { setDashboardData({ monthly_spending: 0, top_categories: [] }); }
      setScreen('dashboard');
      setDashboardLoading(false);
      fetchAccounts();
      fetchTransactions(uid);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); return; }
      const uid = data.user.id;
      setUserId(uid); userIdRef.current = uid;
      setDisplayName(getName(fullName, email));
      setPassword(''); setFullName('');
      setDashboardLoading(true);
      try {
        const s = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (s.ok) setDashboardData(await s.json());
      } catch { setDashboardData({ monthly_spending: 0, top_categories: [] }); }
      setScreen('dashboard');
      setDashboardLoading(false);
    } catch { setError('Could not connect to server'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => {
      setScreen('login'); setUserId(null); userIdRef.current = null;
      setEmail(''); setPassword(''); setFullName(''); setDisplayName(''); setError('');
      setTransactions([]); setAccounts([]); setSelectedAccount(null); setLinkedAccount(null);
      setDashboardData(null);
      setChatMessages([{ id: '0', role: 'assistant', text: "Hi! I'm your WealthPal AI assistant. Ask me anything about your finances!" }]);
    }, 300);
  };

  // ── Data ────────────────────────────────────────────
  const fetchAccounts = async () => {
    if (!userIdRef.current) return;
    setLoadingAccounts(true);
    try {
      const res = await fetch(`${API_URL}/api/plaid/accounts/${userIdRef.current}`);
      const data = await res.json();
      if (data.accounts?.length > 0) {
        setAccounts(data.accounts);
        setSelectedAccount(data.accounts[0]);
        setLinkedAccount(data.itemId);
      }
    } catch {}
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
    setSyncing(true);
    try {
      await fetch(`${API_URL}/api/transactions/sync/${userIdRef.current}`, { method: 'POST' });
      await fetchTransactions();
    } catch {}
    finally { setSyncing(false); }
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
            await fetchAccounts();
            await syncTransactions();
          } catch (err) { setPlaidError(err.message); }
          finally { setPlaidLoading(false); }
        },
        onExit: (exit) => {
          if (exit?.error) setPlaidError(exit.error.display_message || 'Connection failed');
          setPlaidStatus('');
          setPlaidLoading(false);
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
        <StatusBar barStyle="light-content" />
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
        <StatusBar barStyle="light-content" />
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
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={s.authScroll}>
          <View style={s.authTop}>
            <Text style={s.authTitle}>Create Account</Text>
            <Text style={s.authSub}>Join WealthPal AI today</Text>
          </View>
          {!!error && <View style={s.errBox}><Text style={s.errText}>{error}</Text></View>}
          <Text style={s.label}>Full Name</Text>
          <TextInput style={s.input} placeholder="John Doe" placeholderTextColor={C.textMuted} value={fullName} onChangeText={setFullName} editable={!loading} />
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
            {selectedAccount ? `${selectedAccount.subtype} · ${selectedAccount.type}` : 'Connect a bank to get started'}
          </Text>
        </View>

        {/* Account selector */}
        {accounts.length > 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Accounts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {accounts.map(acc => (
                <TouchableOpacity
                  key={acc.account_id}
                  style={[s.chip, selectedAccount?.account_id === acc.account_id && s.chipActive]}
                  onPress={() => setSelectedAccount(acc)}
                >
                  <Text style={[s.chipTitle, selectedAccount?.account_id === acc.account_id && s.chipTitleActive]}>
                    {acc.name}
                  </Text>
                  <Text style={[s.chipSub, selectedAccount?.account_id === acc.account_id && { color: 'rgba(255,255,255,0.7)' }]}>
                    ${fmtMoney(acc.balances?.current || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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

        {/* Top spending */}
        {catData && catData.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Top Spending</Text>
            {catData.map(([cat, amt], i) => (
              <View key={cat} style={s.catRow}>
                <View style={s.catInfo}>
                  <Text style={s.catName}>{getCategoryEmoji(cat)} {cat}</Text>
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
        {!linkedAccount && (
          <View style={s.connectCard}>
            <Text style={s.connectTitle}>🏦 Connect Your Bank</Text>
            <Text style={s.connectText}>Link your bank account to unlock spending insights, transaction history, and personalized financial advice.</Text>
            <TouchableOpacity style={s.btn} onPress={openDrawer}>
              <Text style={s.btnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 20 }} />
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
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📊</Text>
          <Text style={s.emptyTitle}>No insights yet</Text>
          <Text style={s.emptyText}>Connect your bank and sync transactions to see spending insights and charts.</Text>
        </View>
      );
    }

    return (
      <ScrollView style={s.tab} showsVerticalScrollIndicator={false}>
        {/* Summary cards */}
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

        {/* Weekly trend chart */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Weekly Spending</Text>
          <View style={s.chartCard}>
            <LineChart
              data={{
                labels: ['3 wks', '2 wks', 'Last wk', 'This wk'],
                datasets: [{ data: weeklyData.map(v => Math.max(0, v)) }],
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

        {/* Category breakdown */}
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
                      <Text style={s.catName}>{getCategoryEmoji(cat)} {cat}</Text>
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

        {/* Top merchant */}
        {catData && catData[0] && (
          <View style={[s.highlightCard, { borderColor: CAT_COLORS[0] }]}>
            <Text style={s.highlightLabel}>Biggest Category</Text>
            <Text style={s.highlightValue}>{catData[0][0]}</Text>
            <Text style={s.highlightSub}>${fmtMoney(catData[0][1])} · {Math.round((catData[0][1] / total) * 100)}% of total</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
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
          {syncing ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.syncText}>↻ Sync</Text>}
        </TouchableOpacity>
      </View>
      {loadingTx ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
          <Text style={[s.subText, { marginTop: 12 }]}>Loading transactions...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={[s.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💳</Text>
          <Text style={s.emptyTitle}>No transactions yet</Text>
          <Text style={s.emptyText}>Connect your bank account and tap Sync to load your transaction history.</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, i) => item.id?.toString() || item.plaid_transaction_id || i.toString()}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.txItem}>
              <View style={s.txIcon}>
                <Text style={{ fontSize: 20 }}>{getCategoryEmoji(item.category)}</Text>
              </View>
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
          {loadingChat ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.sendBtnText}>↑</Text>}
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
          {/* User section */}
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
              <Text style={s.drawerRowIcon}>🏦</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.drawerRowText}>Connect Bank</Text>
                <Text style={s.drawerRowSub}>{linkedAccount ? 'Connected · tap to reconnect' : 'Not connected'}</Text>
              </View>
              <View style={[s.statusDot, { backgroundColor: linkedAccount ? C.green : C.textMuted }]} />
            </TouchableOpacity>
            {linkedAccount && (
              <TouchableOpacity
                style={s.drawerRow}
                onPress={() => { closeDrawer(); setTimeout(syncTransactions, 300); }}
              >
                <Text style={s.drawerRowIcon}>↻</Text>
                <Text style={s.drawerRowText}>Sync Transactions</Text>
              </TouchableOpacity>
            )}
            {!!plaidError && <Text style={[s.drawerRowSub, { color: C.red, paddingHorizontal: 20, paddingBottom: 8 }]}>{plaidError}</Text>}
            {!!plaidStatus && <Text style={[s.drawerRowSub, { color: C.green, paddingHorizontal: 20, paddingBottom: 8 }]}>{plaidStatus}</Text>}
          </View>

          {/* Settings */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Settings</Text>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>🔔</Text>
              <Text style={[s.drawerRowText, { flex: 1 }]}>Notifications</Text>
              <Switch
                value={notifs}
                onValueChange={setNotifs}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>🔐</Text>
              <Text style={[s.drawerRowText, { flex: 1 }]}>Face ID / Biometrics</Text>
              <Switch
                value={biometrics}
                onValueChange={setBiometrics}
                trackColor={{ false: C.border, true: C.accent }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>🔒</Text>
              <Text style={[s.drawerRowText, { flex: 1 }]}>Privacy & Security</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>💱</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.drawerRowText}>Currency</Text>
                <Text style={s.drawerRowSub}>USD · US Dollar</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Support */}
          <View style={s.drawerGroup}>
            <Text style={s.drawerGroupLabel}>Support</Text>
            <TouchableOpacity style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>❓</Text>
              <Text style={[s.drawerRowText, { flex: 1 }]}>Help & FAQ</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>⭐</Text>
              <Text style={[s.drawerRowText, { flex: 1 }]}>Rate WealthPal AI</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerRow}>
              <Text style={s.drawerRowIcon}>ℹ️</Text>
              <View style={{ flex: 1 }}>
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
      <StatusBar barStyle="light-content" />

      {/* Header */}
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

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'chat' && renderChat()}
      </View>

      {/* Bottom nav */}
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
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════
const s = StyleSheet.create({
  // Layout
  appWrap: { flex: 1, backgroundColor: C.bg },
  bg: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tab: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  // Splash
  splashBg: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  splashIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: C.accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  splashIconText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  splashTitle: { fontSize: 30, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  splashSub: { fontSize: 15, color: C.textSub },

  // Auth
  authScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  authTop: { alignItems: 'center', marginBottom: 36 },
  authTitle: { fontSize: 26, fontWeight: 'bold', color: C.text, marginTop: 20, marginBottom: 8 },
  authSub: { fontSize: 14, color: C.textSub },
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

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerGreet: { fontSize: 12, color: C.textSub, marginBottom: 2 },
  headerName: { fontSize: 20, fontWeight: 'bold', color: C.text },
  menuBtn: { padding: 8, alignItems: 'flex-end', justifyContent: 'center', gap: 5 },
  menuLine: { height: 2, width: 24, backgroundColor: C.text, borderRadius: 2 },

  // Balance card
  balanceCard: { borderRadius: 22, padding: 24, marginBottom: 20, marginTop: 8, backgroundColor: C.accent, shadowColor: C.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 8 },
  balanceAmt: { fontSize: 42, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  balanceSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  // Account chips
  chip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10, minWidth: 120 },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipTitle: { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  chipTitleActive: { color: '#fff' },
  chipSub: { color: C.textMuted, fontSize: 12 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  statLabel: { color: C.textSub, fontSize: 12, marginBottom: 8 },
  statVal: { fontSize: 22, fontWeight: 'bold', color: C.text },

  // Section
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },

  // Category bars
  catRow: { marginBottom: 14 },
  catInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  catName: { color: C.text, fontSize: 14, fontWeight: '500' },
  catAmt: { color: C.textSub, fontSize: 14 },
  barBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },

  // Connect prompt
  connectCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 22, marginBottom: 20 },
  connectTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  connectText: { color: C.textSub, fontSize: 13, lineHeight: 20, marginBottom: 18 },

  // Insights
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

  // Transactions
  txTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  syncText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  txItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, gap: 12 },
  txIcon: { width: 44, height: 44, backgroundColor: C.surface2, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  txMerchant: { color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
  txMeta: { color: C.textSub, fontSize: 12 },
  txAmt: { color: C.red, fontSize: 15, fontWeight: '700' },

  // Chat
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

  // Bottom nav
  bottomNav: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 28, paddingTop: 10 },
  navTab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 20, color: C.textMuted, marginBottom: 3 },
  navIconOn: { color: C.accent },
  navLabel: { fontSize: 10, color: C.textMuted, fontWeight: '500' },
  navLabelOn: { color: C.accent, fontWeight: '700' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 3 },

  // Drawer
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 20 },
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, backgroundColor: C.surface, zIndex: 21, borderLeftWidth: 1, borderLeftColor: C.border },
  drawerUser: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  avatarText: { fontSize: 30, fontWeight: 'bold', color: '#fff' },
  drawerName: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 4 },
  drawerEmail: { fontSize: 13, color: C.textSub },
  drawerGroup: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  drawerGroupLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginTop: 6 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 14 },
  drawerRowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  drawerRowText: { color: C.text, fontSize: 15 },
  drawerRowSub: { color: C.textSub, fontSize: 12, marginTop: 2 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  chevron: { color: C.textMuted, fontSize: 22 },
  logoutBtn: { margin: 20, marginTop: 10, backgroundColor: '#1e0808', borderWidth: 1, borderColor: '#5c1515', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  logoutText: { color: C.red, fontSize: 15, fontWeight: '700' },

  // Misc
  subText: { color: C.textSub, fontSize: 14 },
});
