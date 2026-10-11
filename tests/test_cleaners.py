from shared.cleaners import LocationPlaces


class FakePlaces:
    def search_text(self, **_):
        return {"ResultItems": [
            {"PlaceId": "a", "Title": "Solar", "Distance": 800, "Categories": [{"Name": "Clothing and Accessories"}]},
            {"PlaceId": "b", "Title": "Shine Solar Solution", "Distance": 2600, "Categories": [{"Name": "Business Facility"}]},
            {"PlaceId": "c", "Title": "TATA Power Solar Systems", "Distance": 2700, "Address": {"District": "Navrangpura", "Locality": "Ahmedabad"},
             "Contacts": {"Phones": [{"Value": "+917900000000"}]}},
            {"PlaceId": "d", "Title": "Path Electronic", "Distance": 100},
        ]}


def test_search_keeps_real_solar_businesses_reachable_first():
    p = LocationPlaces.__new__(LocationPlaces)
    p.places = FakePlaces()
    got = p.search(23.03, 72.58)
    assert [x["id"] for x in got] == ["c", "b"]          # clothing shop and non-solar dropped; phone first
    assert got[0] == {"id": "c", "name": "TATA Power Solar Systems", "distance_km": 2.7, "area": "Navrangpura, Ahmedabad",
                      "phone": "+917900000000", "source": "Amazon Location Service"}
