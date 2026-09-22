import pytest
from app.services.nginx_parser import parse_nginx_config, extract_server_blocks, extract_upstreams

def test_basic_server_block():
    config = """
    server {
        listen 80;
        server_name example.com;
        location / {
            proxy_pass http://127.0.0.1:8080;
        }
    }
    """
    parsed = parse_nginx_config(config)
    servers = extract_server_blocks(parsed)
    assert len(servers) == 1
    
    server = servers[0]
    directives = {s["directive"]: s["args"] for s in server if "directive" in s}
    assert directives["listen"] == ["80"]
    assert directives["server_name"] == ["example.com"]
    
    locations = [s for s in server if s.get("directive") == "location"]
    assert len(locations) == 1
    assert locations[0]["args"] == ["/"]
    
    loc_directives = {s["directive"]: s["args"] for s in locations[0]["block"]}
    assert loc_directives["proxy_pass"] == ["http://127.0.0.1:8080"]

def test_upstream_parsing():
    config = """
    upstream backend {
        server 10.0.0.1 weight=5;
        server 10.0.0.2:8080 max_fails=3 fail_timeout=30s;
        server unix:/tmp/backend3 backup;
        server [2001:db8::1]:8080 down;
    }
    """
    parsed = parse_nginx_config(config)
    upstreams = extract_upstreams(parsed)
    assert len(upstreams) == 1
    assert upstreams[0]["name"] == "backend"
    
    targets = [s for s in upstreams[0]["block"] if s.get("directive") == "server"]
    assert len(targets) == 4
    assert targets[0]["args"] == ["10.0.0.1", "weight=5"]
    assert targets[1]["args"] == ["10.0.0.2:8080", "max_fails=3", "fail_timeout=30s"]
    assert targets[2]["args"] == ["unix:/tmp/backend3", "backup"]
    assert targets[3]["args"] == ["[2001:db8::1]:8080", "down"]

def test_comments_and_variables():
    config = """
    # This is a comment
    server {
        listen 443 ssl;
        server_name $host; # inline comment
        
        location /api/ {
            proxy_set_header Host $http_host;
            proxy_pass http://backend;
        }
    }
    """
    parsed = parse_nginx_config(config)
    servers = extract_server_blocks(parsed)
    assert len(servers) == 1
    directives = {s["directive"]: s["args"] for s in servers[0] if "directive" in s}
    assert directives["listen"] == ["443", "ssl"]
    assert directives["server_name"] == ["$host"]

def test_malformed_config():
    # Should not crash, just parse what it can
    config = """
    server {
        listen 80
        server_name example.com;
    }
    """
    parsed = parse_nginx_config(config)
    assert parsed is not None
