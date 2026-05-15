import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, FlatList } from 'react-native';

const API_URL = 'https://financial-ai-advisor-app-production.up.railway.app';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState('Connecting...');
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: '0', role: 'assistant', text: 'Hi! I\'m your financial assistant. Ask me anything about your finances!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalBalance: 5234.56,
    monthlySpending: 1842.33,
    topCategories: [
      { name: 'Groceries', amount: 520 },
      { name: 'Gas', amount: 280 },
      { name: 'Dining', amount: 215 },
    ],
    debts: [
      { name: 'Car Loan', balance: 10500, interest: 5.2 },
    ],
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

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const sampleTransactions = [
        { id: '1', merchant: 'Walmart', amount: 45.50, category: 'Groceries', date: '2026-05-15' },
        { id: '2', merchant: 'Shell Gas', amount: 60.00, category: 'Gas', date: '2026-05-14' },
        { id: '3', merchant: 'Netflix', amount: 15.99, category: 'Subscriptions', date: '2026-05-13' },
        { id: '4', merchant: 'Starbucks', amount: 5.75, category: 'Dining', date: '2026-05-12' },
        { id: '5', merchant: 'Target', amount: 89.32, category: 'Shopping', date: '2026-05-11' },
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
        body: JSON.stringify({
          userId: 'demo-user',
          message: chatInput,
        }),
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
          text: '❌ Error: Could not get response from AI',
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending chat:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: '❌ Error: Could not reach backend',
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingChat(false);
    }
  };

  const renderScreen = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <ScrollView style={styles.dashboardContainer}>
            <Text style={styles.greeting}>Your Finances</Text>
            <Text style={styles.status}>{backendStatus}</Text>

            {/* Total Balance */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>${dashboardData.totalBalance.toFixed(2)}</Text>
            </View>

            {/* Monthly Spending */}
            <View style={[styles.card, styles.spendingCard]}>
              <Text style={styles.cardLabel}>This Month's Spending</Text>
              <Text style={styles.spendingAmount}>${dashboardData.monthlySpending.toFixed(2)}</Text>
            </View>

            {/* Top Categories */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spending by Category</Text>
              {dashboardData.topCategories.map((cat, idx) => (
                <View key={idx} style={styles.categoryRow}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryAmount}>${cat.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>

            {/* Debts */}
            {dashboardData.debts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Debts</Text>
                {dashboardData.debts.map((debt, idx) => (
                  <View key={idx} style={styles.debtRow}>
                    <View>
                      <Text style={styles.debtName}>{debt.name}</Text>
                      <Text style={styles.debtRate}>{debt.interest}% interest</Text>
                    </View>
                    <Text style={styles.debtBalance}>${debt.balance.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
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
        return <Text style={styles.screenText}>Bank Link Coming Soon</Text>;
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
  content: {
    flex: 1,
  },
  dashboardContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  status: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  spendingCard: {
    borderLeftColor: '#ef4444',
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
  spendingAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginTop: 16,
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
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  debtName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  debtRate: {
    color: '#94a3b8',
    fontSize: 12,
  },
  debtBalance: {
    color: '#ef4444',
    fontWeight: '600',
  },
  screenText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
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
