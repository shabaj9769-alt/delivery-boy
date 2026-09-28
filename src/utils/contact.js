import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export const callCustomer = (phone) => {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() => {});
};

const destinationOf = (order) =>
  (order.lat && order.lng) ? `${order.lat},${order.lng}` : encodeURIComponent(order.addr || '');

export const navigateToCustomer = async (order) => {
  try {
    let originParam = '';
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]).catch(() => null);
      if (loc?.coords) originParam = `&origin=${loc.coords.latitude},${loc.coords.longitude}`;
    }
    const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destinationOf(order)}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Maps.'));
  } catch (e) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationOf(order)}&travelmode=driving`).catch(() => {});
  }
};
