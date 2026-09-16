import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { getAuth } from 'firebase/auth';
import { subscribeToSpots } from '../core/spots';

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅（フォールバック）

function buildHtml(spots, center) {
  const markers = spots
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name || '場所' }));

  const firstMarker = markers[0];
  const centerLat = firstMarker ? firstMarker.lat : center.lat;
  const centerLng = firstMarker ? firstMarker.lng : center.lng;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    body { background: #f5f7fb; }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var markers = ${JSON.stringify(markers)};
    markers.forEach(function (m) {
      var marker = L.marker([m.lat, m.lng]).addTo(map);
      marker.bindPopup(m.name || '場所');
      marker.on('click', function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ spotId: m.id }));
      });
    });

    if (markers.length > 0) {
      var bounds = L.latLngBounds(markers.map(function (m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds.pad(0.3));
    }
  </script>
</body>
</html>
`;
}

export default function SpotMapScreen({ navigation }) {
  const [spots, setSpots] = useState([]);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const unsubscribe = subscribeToSpots(uid, setSpots);
    return unsubscribe;
  }, []);

  const validSpots = useMemo(
    () => spots.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number'),
    [spots]
  );

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.spotId) {
        navigation.navigate('SpotDetail', { spotId: data.spotId });
      }
    } catch (e) {
      console.log('map message parse error', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>地図</Text>
      </View>

      {validSpots.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>まだ場所がありません</Text>
          <Text style={styles.emptyText}>右側の一覧から場所を追加して地図に表示しましょう。</Text>
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: buildHtml(validSpots, DEFAULT_CENTER) }}
          onMessage={handleMessage}
          style={styles.webview}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptyText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  webview: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
});
