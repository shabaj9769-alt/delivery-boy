import React from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Header from '../components/Header';
import SirenBanner from '../components/SirenBanner';
import StatCard from '../components/StatCard';
import OrderCard from '../components/OrderCard';
import DeliveredSection from '../components/DeliveredSection';
import { colors } from '../theme/colors';
import { computeStats, round2 } from '../utils/helpers';
import { callCustomer, navigateToCustomer } from '../utils/contact';

export default function DashboardScreen({
  boyName, boyPhone, onLogout,
  isRinging, onStopSiren,
  orders, refreshing, onRefresh, busyOrderId,
  onStartDelivery, onMarkDelivered,
}) {
  const { activeOrders, deliveredToday, cashToday, onlineToday } = computeStats(orders);

  return (
    <SafeAreaView style={s.con}>
      {isRinging && <SirenBanner onStop={onStopSiren} />}
      <Header name={boyName} phone={boyPhone} onLogout={onLogout} />

      <ScrollView
        style={s.body}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={s.statsRow}>
          <StatCard label="Active Tasks" value={activeOrders.length} bg={colors.primarySoft} color={colors.primary} />
          <StatCard label="Delivered Today" value={deliveredToday.length} bg="#e8f5e9" color={colors.success} />
          <StatCard label="Cash in Hand" value={`₹${round2(cashToday)}`} bg="#fbe9e7" color="#d84315" />
        </View>

        <Text style={s.secTitle}>📦 My Active Deliveries ({activeOrders.length})</Text>
        {activeOrders.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ color: '#888', fontSize: 12 }}>No active deliveries assigned right now.</Text>
          </View>
        ) : (
          activeOrders.map(ord => (
            <OrderCard
              key={ord.id}
              order={ord}
              busy={busyOrderId === ord.id}
              onCall={callCustomer}
              onNavigate={navigateToCustomer}
              onStart={onStartDelivery}
              onDeliver={onMarkDelivered}
            />
          ))
        )}

        <DeliveredSection deliveredToday={deliveredToday} cashToday={cashToday} onlineToday={onlineToday} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  con: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 13, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
  emptyBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.primaryLight },
});
