import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState('Connecting...');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: '0', role: 'assistant', text: 'Hi! I\'m your financial assistant. Ask me anything about your finances!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [linkToken, setLinkToken] = useState(null);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [plaidStatus, setPlaidStatus] = useState('');
  const [plaidError, setPlaidError] = useState('');
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [linkedAccount, setLinkedAccount] = useState(null);

  useEffect(() => {
    testBackend();
  }, []);

  const testBackend = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      setBackendStatus('✅ Backend Connected!');
    } catch (error) {
      setBackendStatus('❌ Backend Offline');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      const uid = data.session.user.id;
      setUserId(uid);
      setEmail(email);
      setPassword('');
      setDashboardLoading(true);
      
      try {
        const summaryResponse = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setDashboardData(summaryData);
        }
      } catch (err) {
        console.error('Error loading summary:', err);
        setDashboardData({ monthly_income: 0, monthly_spending: 0, top_categories: [], debt: [] });
      }
      
      setScreen('dashboard');
      setDashboardLoading(false);
    } catch (error) {
      setError('Could not connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Signup failed');
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);
      setEmail(email);
      setPassword('');
      setFullName('');
      setDashboardLoading(true);
      
      try {
        const summaryResponse = await fetch(`${API_URL}/api/ai/financial-summary/${uid}`);
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setDashboardData(summaryData);
        }
      } catch (err) {
        console.error('Error loading summary:', err);
        setDashboardData({ monthly_income: 0, monthly_spending: 0, top_categories: [], debt: [] });
      }
      
      setScreen('dashboard');
      setDashboardLoading(false);
    } catch (error) {
      setError('Could not connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setScreen('login');
    setUserId(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setError('');
    setTransactions([]);
    setChatMessages([{ id: '0', role: 'assistant', text: 'Hi! I\'m your financial assistant. Ask me anything about your finances!' }]);
    setDashboardData(null);
  };

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const sampleTransactions = [
        { id: '1', merchant: 'Walmart', amount: 45.50, category: 'Groceries', date: '2026-05-15' },
        { id: '2', merchant: 'Shell Gas', amount: 60.00, category: 'Gas', date: '2026-05-14' },
        { id: '3', merchant: 'Netflix', amount: 15.99, category: 'Subscriptions', date: '2026-05-13' },
      ];
      setTransactions(sampleTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const createPlaidLinkToken = async () => {
    if (!userId) {
      setError('Please log in before connecting a bank account.');
      return;
    }
    setPlaidError('');
    setPlaidStatus('Creating secure bank link...');
    setPlaidLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Plaid link token');
      }
      if (!data.link_token) {
        throw new Error('Plaid did not return a valid link token');
      }
      setLinkToken(data.link_token);
      setWebviewVisible(true);
      setPlaidStatus('Opening bank connection...');
    } catch (error) {
      console.error('Plaid link token error:', error);
      setPlaidError(error.message || 'Unable to connect to Plaid');
      setPlaidStatus('');
    } finally {
      setPlaidLoading(false);
    }
  };

  const handlePlaidMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.publicToken) {
        setPlaidStatus('Linking your bank account...');
        setWebviewVisible(false);

        const response = await fetch(`${API_URL}/api/plaid/exchange-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicToken: message.publicToken, userId }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to exchange Plaid public token');
        }

        setLinkedAccount(data.itemId || 'Connected');
        setPlaidStatus('Bank account linked successfully!');
        setPlaidError('');
      } else if (message.exit) {
        setWebviewVisible(false);
        setPlaidStatus(message.error ? `Plaid exited: ${message.error}` : 'Plaid flow closed.');
      }
    } catch (error) {
      console.error('Plaid message error:', error);
      setPlaidError(error.message || 'Plaid integration failed');
      setWebviewVisible(false);
    }
  };

  const getPlaidHtml = (token) => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;background:#0f172a;color:#fff;}</style></head><body><script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script><script>var handler = Plaid.create({token:'${token}', onSuccess:function(public_token, metadata){window.ReactNativeWebView.postMessage(JSON.stringify({publicToken:public_token,metadata:metadata}));}, onExit:function(err, metadata){window.ReactNativeWebView.postMessage(JSON.stringify({exit:true,error:err?.display_message||err?.error_message||null,metadata:metadata}));}});handler.open();</script></body></html>`;

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
    };
    setChatMessages([...chatMessages, userMessage]);
    const message = chatInput;
    setChatInput('');
    setLoadingChat(true);

    try {
      console.log(`[Chat] Sending message to: ${API_URL}/api/ai/chat`);
      console.log(`[Chat] Payload:`, { userId, message });
      
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message }),
      });

      console.log(`[Chat] Response status: ${response.status}`);
      console.log(`[Chat] Response headers:`, Object.fromEntries(response.headers));

      if (response.ok) {
        const data = await response.json();
        console.log(`[Chat] Success response:`, data);
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.response,
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        let errorText = 'Unknown error';
        let fullErrorData = null;
        
        try {
          fullErrorData = await response.json();
          errorText = fullErrorData?.error || fullErrorData?.message || JSON.stringify(fullErrorData);
        } catch (parseErr) {
          console.warn('[Chat] Could not parse error JSON, trying text:', parseErr);
          errorText = await response.text().catch(() => 'Empty response body');
        }
        
        const debugInfo = `Status: ${response.status} | ${errorText}`;
        console.error(`[Chat] Error response:`, debugInfo);
        console.error(`[Chat] Full error data:`, fullErrorData);
        
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `❌ Error [${response.status}]: ${errorText}`,
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('[Chat] Network/parsing error:', error);
      console.error('[Chat] Error stack:', error.stack);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: `❌ Error: ${error.message || 'Backend unreachable'}`,
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (screen === 'login') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.authContainer}>
          <Text style={styles.authTitle}>WealthPal AI</Text>
          <Text style={styles.authSubtitle}>Your AI Finance Assistant</Text>

          {error ? <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View> : null}

          <TextInput
            style={styles.authInput}
            placeholder="Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.authButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signupLink]}
            onPress={() => { setScreen('signup'); setError(''); }}
            disabled={loading}
          >
            <Text style={styles.signupText}>Don't have an account? Sign up</Text>
          </TouchableOpacity>

          <Text style={styles.status}>{backendStatus}</Text>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'signup') {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.authContainer}>
          <Text style={styles.authTitle}>Create Account</Text>
          <Text style={styles.authSubtitle}>Join WealthPal AI</Text>

          {error ? <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View> : null}

          <TextInput
            style={styles.authInput}
            placeholder="Full Name"
            placeholderTextColor="#64748b"
            value={fullName}
            onChangeText={setFullName}
            editable={!loading}
          />

          <TextInput
            style={styles.authInput}
            placeholder="Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.authInput}
            placeholder="Password (min 6 characters)"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.authButton, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLink}
            onPress={() => { setScreen('login'); setError(''); }}
            disabled={loading}
          >
            <Text style={styles.signupText}>Already have an account? Login</Text>
          </TouchableOpacity>

          <Text style={styles.status}>{backendStatus}</Text>
        </ScrollView>
      </View>
    );
  }

  if (dashboardLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  const renderScreen = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <ScrollView style={styles.dashboardContainer}>
            <View style={styles.userInfo}>
              <Text style={styles.userEmail}>{email}</Text>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.greeting}>Your Finances</Text>

            {dashboardData ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Monthly Spending</Text>
                  <Text style={styles.balanceAmount}>${(dashboardData.monthly_spending || 0).toFixed(2)}</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Top Categories</Text>
                  {dashboardData.top_categories && dashboardData.top_categories.length > 0 ? (
                    dashboardData.top_categories.map((cat, idx) => (
                      <View key={idx} style={styles.categoryRow}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.categoryAmount}>${(cat.amount || 0).toFixed(2)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No spending data yet</Text>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>Loading...</Text>
            )}
          </ScrollView>
        );
      case 'transactions':
        return (
          <ScrollView style={styles.transactionsContainer}>
            <TouchableOpacity 
              style={styles.loadButton}
              onPress={loadTransactions}
              disabled={loadingTransactions}
            >
              <Text style={styles.loadButtonText}>
                {loadingTransactions ? 'Loading...' : 'Load Transactions'}
              </Text>
            </TouchableOpacity>

            {transactions.length > 0 && (
              <View style={styles.transactionsList}>
                {transactions.map((tx) => (
                  <View key={tx.id} style={styles.transactionItem}>
                    <View style={styles.txLeft}>
                      <Text style={styles.merchant}>{tx.merchant}</Text>
                      <Text style={styles.date}>{tx.date}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={styles.amount}>-${tx.amount.toFixed(2)}</Text>
                      <Text style={styles.category}>{tx.category}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        );
      case 'bank':
        return (
          <View style={styles.bankContainer}>
            <Text style={styles.bankTitle}>Connect Your Bank</Text>
            <Text style={styles.bankSubtitle}>Use Plaid to securely connect your account.</Text>

            {linkedAccount ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>Bank connection established.</Text>
                <Text style={styles.infoText}>Account ID: {linkedAccount}</Text>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>Link your bank account to sync transactions and power financial insights.</Text>
              </View>
            )}

            {plaidStatus ? <Text style={styles.plaidStatusText}>{plaidStatus}</Text> : null}
            {plaidError ? <Text style={styles.plaidErrorText}>{plaidError}</Text> : null}

            {!webviewVisible ? (
              <TouchableOpacity
                style={[styles.linkButton, plaidLoading && styles.buttonDisabled]}
                onPress={createPlaidLinkToken}
                disabled={plaidLoading}
              >
                {plaidLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.linkButtonText}>{linkedAccount ? 'Reconnect Bank' : 'Connect Bank'}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.webviewWrapper}>
                <WebView
                  originWhitelist={['*']}
                  source={{ html: getPlaidHtml(linkToken) }}
                  onMessage={handlePlaidMessage}
                  onError={(event) => setPlaidError(`WebView error: ${event.nativeEvent.description}`)}
                  onLoadStart={() => setPlaidStatus('Loading bank connection...')}
                  onLoadEnd={() => setPlaidStatus('Bank connection loaded')}
                  onShouldStartLoadWithRequest={() => true}
                  startInLoadingState
                  javaScriptEnabled
                  domStorageEnabled
                  mixedContentMode="always"
                  allowFileAccess
                  allowUniversalAccessFromFileURLs
                  style={styles.webview}
                />
                <TouchableOpacity
                  style={styles.closeWebviewButton}
                  onPress={() => setWebviewVisible(false)}
                >
                  <Text style={styles.closeWebviewText}>Close Plaid</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      case 'chat':
        return (
          <View style={styles.chatContainer}>
            <FlatList
              data={chatMessages}
              renderItem={({ item }) => (
                <View style={[styles.messageBubble, item.role === 'user' && styles.userBubble]}>
                  <Text style={[styles.messageText, item.role === 'user' && styles.userText]}>
                    {item.text}
                  </Text>
                </View>
              )}
              keyExtractor={(item) => item.id}
              style={styles.messagesList}
            />
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask about your finances..."
                placeholderTextColor="#64748b"
                value={chatInput}
                onChangeText={setChatInput}
                editable={!loadingChat}
              />
              <TouchableOpacity 
                style={[styles.sendButton, loadingChat && styles.sendButtonDisabled]}
                onPress={sendChatMessage}
                disabled={loadingChat || !chatInput.trim()}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return <Text style={styles.screenText}>Dashboard</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.appLayout}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'dashboard' && styles.bottomTabActive]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.bottomTabText}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'transactions' && styles.bottomTabActive]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={styles.bottomTabText}>Transactions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'bank' && styles.bottomTabActive]}
          onPress={() => setActiveTab('bank')}
        >
          <Text style={styles.bottomTabText}>Bank</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'chat' && styles.bottomTabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={styles.bottomTabText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 14, marginTop: 16 },
  authContainer: { flex: 1, padding: 24, paddingTop: 60 },
  authTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  authSubtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32, textAlign: 'center' },
  errorBox: { backgroundColor: '#7f1d1d', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#fecaca', fontSize: 14 },
  authInput: { width: '100%', backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#334155' },
  authButton: { width: '100%', backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { opacity: 0.6 },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signupLink: { alignItems: 'center', paddingVertical: 12 },
  signupText: { color: '#3b82f6', fontSize: 14 },
  status: { color: '#94a3b8', fontSize: 12, marginTop: 24, textAlign: 'center' },
  content: { flex: 1, minWidth: 0, backgroundColor: '#0f172a', paddingBottom: 140 },
  appLayout: { flex: 1, backgroundColor: '#0f172a' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#1f2937', elevation: 12, zIndex: 10, paddingBottom: 26 },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginHorizontal: 4, borderRadius: 10, backgroundColor: '#111827' },
  bottomTabActive: { backgroundColor: '#1f2937' },
  bottomTabText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  userInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1e293b', marginBottom: 16, borderRadius: 14 },
  userEmail: { color: '#94a3b8', fontSize: 12 },
  logoutBtn: { backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dashboardContainer: { flex: 1, padding: 16 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  cardLabel: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8 },
  categoryName: { color: '#fff', fontSize: 14 },
  categoryAmount: { color: '#3b82f6', fontWeight: '600' },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  transactionsContainer: { flex: 1, padding: 16 },
  loadButton: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  loadButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  transactionsList: { marginTop: 8 },
  transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8 },
  txLeft: { flex: 1 },
  merchant: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  date: { color: '#94a3b8', fontSize: 12 },
  txRight: { alignItems: 'flex-end' },
  amount: { color: '#ef4444', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  category: { color: '#3b82f6', fontSize: 12 },
  bankContainer: { flex: 1, padding: 16, paddingTop: 20 },
  bankTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  bankSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  infoBox: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16 },
  infoText: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  chatContainer: { flex: 1, flexDirection: 'column' },
  messagesList: { flex: 1, padding: 16 },
  messageBubble: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 12, maxWidth: '80%' },
  userBubble: { backgroundColor: '#3b82f6', alignSelf: 'flex-end' },
  messageText: { color: '#e2e8f0', fontSize: 14, lineHeight: 18 },
  userText: { color: '#fff' },
  inputContainer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0f172a' },
  input: { flex: 1, backgroundColor: '#1e293b', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, fontSize: 14 },
  sendButton: { backgroundColor: '#3b82f6', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#475569' },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  linkButton: { backgroundColor: '#3b82f6', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  linkButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  plaidStatusText: { color: '#22c55e', fontSize: 14, marginTop: 12, textAlign: 'center' },
  plaidErrorText: { color: '#fca5a5', fontSize: 14, marginTop: 12, textAlign: 'center' },
  webviewWrapper: { flex: 1, borderRadius: 16, overflow: 'hidden', marginTop: 16, backgroundColor: '#000' },
  webview: { flex: 1, minHeight: 400 },
  closeWebviewButton: { backgroundColor: '#111827', paddingVertical: 12, alignItems: 'center', borderRadius: 10, marginTop: 12 },
  closeWebviewText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bankContainer: { flex: 1, padding: 16, paddingTop: 20 },
  bankTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  bankSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  infoBox: { backgroundColor: '#1e293b', borderRadius: 8, padding: 16 },
  infoText: { color: '#cbd5e1', fontSize: 14, lineHeight: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#3b82f6' },
  tabText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  screenText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
});
