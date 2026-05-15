import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, FlatList, Alert } from 'react-native';

const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('Connecting...');
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: '0', role: 'assistant', text: 'Hi! I\'m your financial assistant. Ask me anything about your finances!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [linkingBank, setLinkingBank] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalBalance: 0,
    monthlySpending: 0,
    topCategories: [],
    debts: [],
  });

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

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUserId(data.user.id);
        setIsLoggedIn(true);
        setEmail('');
        setPassword('');
        Alert.alert('Success', 'Account created! Welcome to WealthPal AI');
      } else {
        Alert.alert('Error', data.error || 'Signup failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUserId(data.session.user.id);
        setIsLoggedIn(true);
        setEmail('');
        setPassword('');
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        Alert.alert('Error', data.error || 'Login failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserId(null);
    setEmail('');
    setPassword('');
    setTransactions([]);
    setChatMessages([{ id: '0', role: 'assistant', text: 'Hi! I\'m your financial assistant. Ask me anything about your finances!' }]);
    setConnectedAccounts([]);
    setDashboardData({
      totalBalance: 0,
      monthlySpending: 0,
      topCategories: [],
      debts: [],
    });
  };

  const createPlaidLinkToken = async () => {
    setLinkingBank(true);
    try {
      const response = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'Bank Linking',
          'Link token created! In production, this would open Plaid Link.\n\nFor testing, use sandbox credentials:\nUsername: user_good\nPassword: pass_good',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to create link token');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to backend');
    } finally {
      setLinkingBank(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai/financial-summary/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadDashboardData();
    }
  }, [isLoggedIn]);

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      // For now, show sample transactions
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

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
    };
    setChatMessages([...chatMessages, userMessage]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: chatInput }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.response,
        };
        setChatMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: '❌ Error: Could not get response',
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: '❌ Error: Backend unreachable',
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingChat(false);
    }
  };

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>WealthPal AI</Text>
          <Text style={styles.authSubtitle}>Your AI Finance Assistant</Text>

          <TextInput
            style={styles.authInput}
            placeholder="Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.authButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.authButtonText}>
              {loading ? 'Loading...' : 'Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authButton, styles.signupButton]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.authButtonText}>
              {loading ? 'Loading...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.status}>{backendStatus}</Text>
        </View>
      </View>
    );
  }

  // MAIN APP SCREEN
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

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Monthly Spending</Text>
              <Text style={styles.balanceAmount}>${dashboardData.monthlySpending.toFixed(2)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Categories</Text>
              {dashboardData.topCategories.length > 0 ? (
                dashboardData.topCategories.map((cat, idx) => (
                  <View key={idx} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryAmount}>${cat.amount.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No spending data yet</Text>
              )}
            </View>
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
      case 'bank':
        return (
          <ScrollView style={styles.bankContainer}>
            <Text style={styles.bankTitle}>Connect Your Bank</Text>

            <TouchableOpacity 
              style={styles.plaidButton}
              onPress={createPlaidLinkToken}
              disabled={linkingBank}
            >
              <Text style={styles.plaidButtonText}>
                {linkingBank ? 'Connecting...' : '🏦 Connect with Plaid'}
              </Text>
            </TouchableOpacity>

            <View style={styles.benefitsBox}>
              <Text style={styles.benefitsTitle}>What you get:</Text>
              <Text style={styles.benefit}>✓ Automatic transaction sync</Text>
              <Text style={styles.benefit}>✓ Real-time balance updates</Text>
              <Text style={styles.benefit}>✓ Smart spending insights</Text>
            </View>
          </ScrollView>
        );
      default:
        return <Text style={styles.screenText}>Dashboard</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Text style={styles.tabText}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={styles.tabText}>Transactions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={styles.tabText}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'bank' && styles.activeTab]}
          onPress={() => setActiveTab('bank')}
        >
          <Text style={styles.tabText}>Bank</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  authInput: {
    width: '100%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  authButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  signupButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 24,
  },
  content: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    marginBottom: 16,
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dashboardContainer: {
    flex: 1,
    padding: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  cardLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryName: {
    color: '#fff',
    fontSize: 14,
  },
  categoryAmount: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  transactionsContainer: {
    flex: 1,
    padding: 16,
  },
  loadButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsList: {
    marginTop: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  txLeft: {
    flex: 1,
  },
  merchant: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    color: '#94a3b8',
    fontSize: 12,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  amount: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  category: {
    color: '#3b82f6',
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
  },
  messageText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 18,
  },
  userText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  sendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bankContainer: {
    flex: 1,
    padding: 16,
  },
  bankTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  plaidButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  plaidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  benefitsBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  benefit: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  screenText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
});
