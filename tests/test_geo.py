from shared.geo import geohash


def test_known_geohashes():
    assert geohash(57.64911, 10.40744, 11) == "u4pruydqqvj"   # reference value from the geohash spec
    assert geohash(23.09, 72.58) == geohash(23.091, 72.581)    # same Ahmedabad cell
    assert len(geohash(23.09, 72.58)) == 5
