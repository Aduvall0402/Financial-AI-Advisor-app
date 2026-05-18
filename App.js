import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const API_URL = 'financial-ai-advisor-app-production.up.railway.app';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('Connecting...');

  useEffect(() => {
    testBackend();
  }, []);

  const testBackend = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      setMessage('✅ Backend Connected!');
    } catch (error) {
      setMessage('❌ Backend Offline');
    }
  };

  const renderScreen = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <View style={styles.screenContent}>
            <Text style={styles.screenText}>Dashboard</Text>
            <Text style={styles.statusText}>{message}</Text>
          </View>
        );
      case 'transactions':
        return <Text style={styles.screenText}>Transactions</Text>;
      case 'chat':
        return <Text style={styles.screenText}>Chat</Text>;
      case 'bank':
        return <Text style={styles.screenText}>Bank Link</Text>;
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenContent: {
    alignItems: 'center',
  },
  screenText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
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
