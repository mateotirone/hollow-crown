# Everwake 3D pages

One self-contained page per build (packed, gzipped meshes inline; real Bedrock block textures), published as
artifacts for Mateo's review: the city https://claude.ai/artifact/Nta25jXtY8KV5nKpX89TpU and the air boat
station https://claude.ai/artifact/FMsPEnYSySaimmZz7YaU1X.

    PYTHONHASHSEED=0 python3 map/structures/everwake_builds.py OUT            # city + station (restored, ruin)
    python3 backdrop.py <map terrain.npz> <textures/blocks> backdrop.json -60 300 704 255   # Aldmere below (map/draw_map.py writes terrain.npz)
    python3 mkpage.py OUT/everwake_city/scene.json <textures/blocks> viewer.tpl.html city.html "Everwake Cloud City" "blurb" city_views.json backdrop.json
    python3 combine_st.py <dir holding st/airboat_station_*>   # both station versions side by side -> st/both.json
    python3 mkpage.py st/both.json <textures/blocks> viewer.tpl.html station.html "Air Boat Station" "blurb" station_views.json

Textures: Mojang/bedrock-samples resource_pack/textures/blocks. The page loads three@0.170.0 from jsDelivr.
