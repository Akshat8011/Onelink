import React, { useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../components/ScreenWrapper';
import StackHeader from '../components/StackHeader';
import { colors, spacing, borderRadius, fontSize, shadows } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { getVehicleInfo, validateRegistrationNumber } from '../services/vehicleInfoApi';
import { useAppTheme } from '../hooks/useAppTheme';
import { useI18n } from '../hooks/useI18n';
import { useThemedStyles } from '../hooks/useThemedStyles';

type Route = RouteProp<RootStackParamList, 'VehicleInfo'>;

function InfoRow({ label, value, rowStyle, labelStyle, valueStyle }: { label: string; value: string; rowStyle: object; labelStyle: object; valueStyle: object }) {
  return (
    <View style={rowStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

export default function VehicleInfoScreen() {
  const params = useRoute<Route>().params;
  const theme = useAppTheme();
  const { t } = useI18n();
  const styles = useThemedStyles((th) => StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 40 },
    searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    input: { flex: 1, borderWidth: 1, borderColor: th.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, fontWeight: '700', color: th.text, backgroundColor: th.surface },
    searchBtn: { backgroundColor: colors.parking, width: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.error, marginBottom: spacing.md, backgroundColor: colors.errorLight, padding: spacing.md, borderRadius: borderRadius.md },
    heroCard: { backgroundColor: th.parkingHeader, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg, ...shadows.elevated },
    plate: { color: colors.white, fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: 2 },
    model: { color: colors.white, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },
    variant: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, marginTop: 4 },
    section: { fontSize: fontSize.md, fontWeight: '800', color: th.text, marginBottom: spacing.sm, marginTop: spacing.sm },
    card: { backgroundColor: th.surfaceMuted, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: th.border },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    infoLabel: { color: th.textMuted, fontSize: fontSize.sm },
    infoValue: { color: th.text, fontWeight: '600', fontSize: fontSize.sm, maxWidth: '55%', textAlign: 'right' },
    noChallanCard: { backgroundColor: colors.successLight, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
    noChallan: { color: colors.success, fontWeight: '700', fontSize: fontSize.lg, marginTop: spacing.sm },
    noChallanSub: { color: colors.success, fontSize: fontSize.sm, marginTop: spacing.xs },
    challanCard: { backgroundColor: th.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.errorLight, ...shadows.soft },
    challanTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    challanId: { fontWeight: '700', color: th.text },
    challanBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
    paid: { backgroundColor: colors.successLight },
    pending: { backgroundColor: colors.errorLight },
    challanStatus: { fontSize: 10, fontWeight: '800', color: th.text },
    challanViolation: { color: colors.error, fontWeight: '700', marginTop: 4, fontSize: fontSize.md },
    challanMeta: { color: th.textMuted, fontSize: fontSize.xs, marginTop: 4 },
    challanAmount: { color: th.text, fontSize: fontSize.lg, fontWeight: '800', marginTop: spacing.sm },
  }));
  const [input, setInput] = React.useState(params?.plate || '');
  const [isLoading, setIsLoading] = React.useState(false);
  const [vehicle, setVehicle] = React.useState<any>(null);
  const [error, setError] = React.useState<string>('');

  useEffect(() => {
    if (params?.plate) handleSearch(params.plate);
  }, [params?.plate]);

  const handleSearch = async (searchNumber?: string) => {
    const numberToSearch = searchNumber || input;
    
    if (!validateRegistrationNumber(numberToSearch)) {
      setError('Invalid vehicle number format. Example: UP 32 AB 1234');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await getVehicleInfo(numberToSearch);
      
      if (response.success && response.data) {
        setVehicle(response.data);
      } else {
        setError(response.message || 'Vehicle not found');
        setVehicle(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicle details');
      setVehicle(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenWrapper edges={['top']} style={{ backgroundColor: theme.bg }}>
      <StackHeader title={t('vehicleInfo')} subtitle={t('rtoDetails')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="UP 32 AB 1234"
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch()} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {vehicle && (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.plate}>{vehicle.registrationNumber}</Text>
              <Text style={styles.model}>{vehicle.make} {vehicle.model}</Text>
              <Text style={styles.variant}>{vehicle.variant} · {vehicle.fuelType} · {vehicle.color}</Text>
            </View>

            <Text style={styles.section}>Owner & Registration</Text>
            <View style={styles.card}>
              <InfoRow label="Owner" value={vehicle.ownerName} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Registered" value={vehicle.registrationDate} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="RTO" value={vehicle.rtoOffice} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="State" value={vehicle.rtoState} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="RC Status" value={vehicle.rcStatus} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
            </View>

            <Text style={styles.section}>Validity & Compliance</Text>
            <View style={styles.card}>
              <InfoRow label="Fitness valid till" value={vehicle.fitnessUpto} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Insurance till" value={vehicle.insuranceUpto} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              {vehicle.insuranceCompany && <InfoRow label="Insurance Co." value={vehicle.insuranceCompany} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />}
              <InfoRow label="PUC till" value={vehicle.pollutionUpto} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              {vehicle.taxUpto && <InfoRow label="Tax till" value={vehicle.taxUpto} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />}
              {vehicle.norms && <InfoRow label="Emission Norms" value={vehicle.norms} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />}
            </View>

            <Text style={styles.section}>Vehicle Details</Text>
            <View style={styles.card}>
              <InfoRow label="Chassis" value={vehicle.chassisNumber} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Engine" value={vehicle.engineNumber} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Vehicle Class" value={vehicle.vehicleClass} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Seating" value={String(vehicle.seatingCapacity)} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
              <InfoRow label="Manufacturing Year" value={String(vehicle.manufacturingYear)} rowStyle={styles.infoRow} labelStyle={styles.infoLabel} valueStyle={styles.infoValue} />
            </View>

            <Text style={styles.section}>Traffic Challans ({vehicle.challanDetails?.length || 0})</Text>
            {(!vehicle.challanDetails || vehicle.challanDetails.length === 0) ? (
              <View style={styles.noChallanCard}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={styles.noChallan}>No pending challans</Text>
                <Text style={styles.noChallanSub}>You're all clear!</Text>
              </View>
            ) : (
              vehicle.challanDetails.map((c: any) => (
                <View key={c.challanId} style={styles.challanCard}>
                  <View style={styles.challanTop}>
                    <Text style={styles.challanId}>{c.challanId}</Text>
                    <View style={[styles.challanBadge, c.status === 'PAID' ? styles.paid : styles.pending]}>
                      <Text style={styles.challanStatus}>{c.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.challanViolation}>{c.violation}</Text>
                  <Text style={styles.challanMeta}>{c.date} · {c.location}</Text>
                  <Text style={styles.challanAmount}>₹{c.amount}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
