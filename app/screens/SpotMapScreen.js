import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getAuth } from 'firebase/auth';
import { subscribeToSpots } from '../core/spots';

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅（フォールバック）

function buildHtml(spots, center) {
  const markers = spots
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name }));

  const firstMarker = markers[0];
  const centerLat = firstMarker ? firstMarker.lat : center.lat;
  const centerLng = firstMarker ? firstMarker.lng : center.lng;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${centerLat}, ${centerLng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var markers = ${JSON.stringify(markers)};
    markers.forEach(function (m) {
      var marker = L.marker([m.lat, m.lng]).addTo(map);
      marker.bindPopup(m.name);
      marker.on('click', function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ spotId: m.id }));
      });
    });
  </script>
</body>
</html>
`;
}

// 地図タブ。登録済みスポットをピンで表示し、タップで④カルテへ遷移する。A担当。
export default function SpotMapScreen({ navigation }) {
  const [spots, setSpots] = useState([]);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToSpots(uid, setSpots);
    return unsubscribe;
  }, []);

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
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildHtml(spots, DEFAULT_CENTER) }}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});
