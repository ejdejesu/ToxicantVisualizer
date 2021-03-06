import "./index.css";
import "../index.css";
import { silver } from "./mapstyles";
import MarkerCluster from "./MarkerClusterer";
import LoadingSpinner from "../LoadingSpinner";
import PropTypes from "prop-types";
const React = require("react");
const vetapi = require("../api/vetapi/index");
const { shallowEqual } = require("../helpers");
const Component = React.Component;
const { Map, InfoWindow } = require("google-maps-react");

const containerStyle = {
  position: "relative",
  overflow: "hidden",
  height: "100%",
  width: "100%",
};

// Wrapping class around Google Maps react object
class GoogleMap extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeMarker: null,
      markers: [],
      points: [],
      latLngbounds: null,
      showingInfoWindow: false,
      isLoading: true,
      map: null,
      hasMoved: false,
    };

    this.fetchPoints = this.fetchPoints.bind(this);
    this.storeFacilities = this.storeFacilities.bind(this);
    this.handleMount = this.handleMount.bind(this);
    this.adjustMap = this.adjustMap.bind(this);
    this.onMarkerClick = this.onMarkerClick.bind(this);
    this.createMarkers = this.createMarkers.bind(this);
    this.onRefresh = this.onRefresh.bind(this);
  }

  /* User hits re-center - Sidebar is cleared of any pubchem data and map restores to original searched center */
  onRefresh() {
    const newState = {};
    if (this.map && this.state.latLngbounds) {
      this.resetMapView(this.map, this.state.latLngbounds);
    }
    newState.showingInfoWindow = false;
    newState.hasMoved = false;
    this.setState(newState, () => {
      this.props.onRefresh();
    });
  }

  /* Props to the map component have changed */
  componentDidUpdate(prevProps) {
    const refiltered = !shallowEqual(prevProps.filters, this.props.filters);
    if (refiltered) {
      const newState = {};

      // recenter map when filters change
      this.resetMapView(this.map, this.state.latLngbounds);

      // when filters change, new data must be fetched from the VET API
      this.setState({ isLoading: true, markers: {} }, () => {
        this.fetchPoints(this.props.map, this.props.filters).then((data) =>
          this.storeFacilities(data)
        );
      });
      newState.showingInfoWindow = false;
      this.setState(newState);
    }
  }

  /* Handle facility select. This gets passed down to marker clusterer */
  onMarkerClick(props) {
    const showing = this.state.showingInfoWindow;
    if (!showing || !shallowEqual(this.state.activeMarker, props.entry)) {
      this.setState(
        {
          activeMarker: props.entry,
          showingInfoWindow: true,
          hasMoved: true,
        },
        () => {
          this.map.setCenter(props.marker.position);
          /* best looking zoom level */
          this.map.setZoom(14);
          this.props.onMarkerClick(props.entry.meta.id);
        }
      );
    } else {
      this.setState({
        showingInfoWindow: false,
      });
    }
  }

  uniq(a) {
    var seen = {};
    return a.filter(function (item) {
      return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
  }

  /* Retrieve list of facilities from VET api */
  async fetchPoints(map, filters) {
    let facilityData = null;

    try {
      const params = {
        state: map.state,
        county: map.county,
        city: map.city,
        carcinogen: filters.carcinogen || null,
        pbt: filters.pbt || null,
        release_type: filters.releaseType,
        chemical: filters.chemical,
        year: filters.year,
      };

      const res = await vetapi.get(`/facilities`, { params });
      facilityData = res.data;
      return facilityData;
    } catch (err) {
      console.log(err);
      if (this.props.onApiError) this.props.onApiError();
    }
  }

  /* map startup */
  handleMount(mapProps, map) {
    this.map = map;
    const mapsApi = window.google.maps;
    setTimeout(() => {
      mapsApi.event.addListener(map, "dragend", () => {
        this.setState({ hasMoved: true });
      });
    }, 1000);

    this.adjustMap(mapProps, map);
  }

  resetMapView(map, bounds) {
    map.fitBounds(bounds);

    /* optionally increase zoom on areas */
    // const zoom = map.getZoom();
    // if (zoom) {
    //   map.setZoom(zoom + 1);
    // }
  }

  /* move map window when location has changed. Once map is finished moving, facilities are populated  */
  adjustMap(mapProps, map) {
    const mapsApi = window.google.maps;
    const viewport = this.props.map.viewport;
    if (viewport) {
      try {
        const b = this.createLatLngBounds(viewport, mapsApi);
        this.setState({ latLngbounds: b }, () => {
          this.resetMapView(map, b);
        });
        mapsApi.event.addListenerOnce(map, "idle", () => {
          this.setState(
            {
              isLoading: true,
            },
            () => {
              // const facilityData = JSON.parse(
              //   sessionStorage.getItem("facilityData")
              // );
              // if (facilityData === null)
              this.fetchPoints(
                this.props.map,
                this.props.filters
              ).then((data) => this.storeFacilities(data));
              // else {
              //   this.storeFacilities(facilityData);
              // }
            }
          );
        });
      } catch (err) {
        console.log(err);
      }
    }
  }

  storeFacilities(data) {
    this.setState(
      {
        points: data,
        markers: this.createMarkers(data),
      },
      () => {
        sessionStorage.setItem("facilityData", JSON.stringify(data));
      }
    );
  }

  createLatLngBounds(viewport, api) {
    const n = new api.LatLng(viewport.northeast.lat, viewport.northeast.lng);
    const s = new api.LatLng(viewport.southwest.lat, viewport.southwest.lng);
    return new api.LatLngBounds(s, n);
  }

  /* arbitrary legend, could use changing to not be hardcoded */
  getColor(total) {
    let color = 1;
    if (total < 100) color = 1;
    else if (total < 100) color = 2;
    else if (total < 10000) color = 3;
    else if (total < 100000) color = 4;
    else if (total < 1000000) color = 5;
    else color = 6;
    return color;
  }

  // create a map marker for every point that is passed to the map
  createMarkers(points) {
    const facilities = points;
    const markers = facilities.map((facility, i) => {
      return {
        meta: facility,
        color: this.getColor(facility.total),
        name: facility.name,
        position: {
          lat: parseFloat(facility.latitude),
          lng: parseFloat(facility.longitude),
        },
      };
    });
    this.setState({
      isLoading: false,
    });
    return markers;
  }

  render() {
    return (
      <div className={`map-container ${this.state.isLoading ? "loading" : ""}`}>
        {this.state.isLoading && (
          <div className="loading-overlay">
            <div className="spinner">
              <LoadingSpinner></LoadingSpinner>
            </div>
          </div>
        )}
        {this.state.hasMoved && (
          <div className="refresh" onClick={this.onRefresh}>
            RECENTER
          </div>
        )}
        <div className="map">
          {/* Google Map component from google-maps-react */}
          <Map
            onReady={this.handleMount}
            google={window.google}
            streetViewControl={false}
            styles={silver}
            draggable={true}
            fullscreenControl={false}
            zoom={5}
            minZoom={5}
            containerStyle={containerStyle}
          >
            {this.state.markers.length > 0 && (
              <MarkerCluster
                releaseType={this.props.filters.releaseType}
                markers={this.state.markers}
                click={this.onMarkerClick}
                minimumClusterSize={15}
              />
            )}
            <InfoWindow
              marker={this.state.activeMarker}
              visible={this.state.showingInfoWindow}
            >
              <div className="info-window">
                {this.state.activeMarker !== null && (
                  <div>
                    <h2>{this.state.activeMarker.name}</h2>
                    <p>
                      {this.state.activeMarker.meta.street_address} <br></br>
                      {this.state.activeMarker.meta.city},{" "}
                      {this.state.activeMarker.meta.state}{" "}
                      {this.state.activeMarker.meta.zip}
                    </p>
                    <p>
                      Industry: {this.state.activeMarker.meta.industry_sector}
                    </p>
                    <p>
                      Total Toxicants Released:{" "}
                      <span style={{ fontWeight: "bold" }}>
                        {this.state.activeMarker.meta.total.toLocaleString()}{" "}
                        lbs
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </InfoWindow>
          </Map>
          )
        </div>
      </div>
    );
  }
}
GoogleMap.propTypes = {
  filters: PropTypes.shape({
    chemical: PropTypes.string.isRequired,
    pbt: PropTypes.bool.isRequired,
    carcinogen: PropTypes.bool.isRequired,
    releaseType: PropTypes.oneOf([
      "all",
      "air",
      "water",
      "land",
      "on_site",
      "off_site",
    ]).isRequired,
    year: PropTypes.number.isRequired,
  }),
  map: PropTypes.shape({
    city: PropTypes.string,
    county: PropTypes.string,
    state: PropTypes.string,
    stateLong: PropTypes.string,
    center: PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lng: PropTypes.number.isRequired,
    }).isRequired,
    viewport: PropTypes.shape({
      northeast: PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lng: PropTypes.number.isRequired,
      }).isRequired,
      southwest: PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lng: PropTypes.number.isRequired,
      }).isRequired,
    }),
  }),
};

export default GoogleMap;
