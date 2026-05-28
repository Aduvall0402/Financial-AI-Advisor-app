import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { FinlitWidget } from './widgets/FinlitWidget';

async function widgetTaskHandler({ widgetInfo, renderWidget }) {
  const [budgetData, statsData, recentTxData] = await Promise.all([
    AsyncStorage.getItem('widgetBudgetData'),
    AsyncStorage.getItem('widgetStatsData'),
    AsyncStorage.getItem('widgetRecentTx'),
  ]);

  renderWidget(
    <FinlitWidget
      width={widgetInfo.width}
      height={widgetInfo.height}
      budgetData={budgetData || ''}
      statsData={statsData || ''}
      recentTxData={recentTxData || ''}
    />
  );
}

registerWidgetTaskHandler(widgetTaskHandler);
