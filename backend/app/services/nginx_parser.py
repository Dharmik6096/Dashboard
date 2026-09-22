import re
from typing import List, Dict, Any, Tuple

class NginxParseError(Exception):
    pass

class NginxParser:
    def __init__(self, config_text: str):
        self.config_text = config_text
        # Remove comments, handling edge cases where # might be in a string is complex,
        # but for typical read-only parsing, a simple regex or line-by-line is safe enough for # comments.
        self.tokens = self._tokenize(config_text)
        self.pos = 0

    def _tokenize(self, text: str) -> List[str]:
        # Strip comments safely (ignoring # inside quotes is hard with simple regex, but we do our best)
        lines = []
        for line in text.split('\n'):
            # simple comment stripping (doesn't handle # inside string well, but Nginx rarely uses # in strings without quotes, and we can just regex it)
            # A better way is regex that matches quotes or comments:
            pass
            
        # A more robust tokenizer regex that yields strings, words, brackets, semicolons
        token_pattern = re.compile(
            r'(?P<comment>#.*$)|'
            r'(?P<string>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|'
            r'(?P<block_start>\{)|'
            r'(?P<block_end>\})|'
            r'(?P<semicolon>;)|'
            r'(?P<word>[^{};\'"\s]+)',
            re.MULTILINE
        )
        
        tokens = []
        for match in token_pattern.finditer(text):
            if match.lastgroup == 'comment':
                continue
            if match.lastgroup == 'string':
                # Strip surrounding quotes
                tokens.append(match.group('string')[1:-1])
            else:
                tokens.append(match.group())
        return tokens

    def parse(self) -> List[Dict[str, Any]]:
        return self._parse_block()

    def _parse_block(self) -> List[Dict[str, Any]]:
        statements = []
        while self.pos < len(self.tokens):
            token = self.tokens[self.pos]
            
            if token == '}':
                break
                
            # It's a directive
            directive = []
            while self.pos < len(self.tokens):
                t = self.tokens[self.pos]
                if t == ';':
                    self.pos += 1
                    statements.append({"directive": directive[0], "args": directive[1:]})
                    break
                elif t == '{':
                    self.pos += 1
                    block_content = self._parse_block()
                    if self.pos < len(self.tokens) and self.tokens[self.pos] == '}':
                        self.pos += 1
                    statements.append({"directive": directive[0], "args": directive[1:], "block": block_content})
                    break
                else:
                    directive.append(t)
                    self.pos += 1
                    
        return statements

def parse_nginx_config(config_text: str) -> List[Dict[str, Any]]:
    parser = NginxParser(config_text)
    return parser.parse()

def extract_server_blocks(parsed: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # recursively find all server blocks
    servers = []
    
    def walk(stmts):
        for stmt in stmts:
            if stmt.get("directive") == "server" and "block" in stmt:
                servers.append(stmt["block"])
            elif "block" in stmt:
                walk(stmt["block"])
                
    walk(parsed)
    return servers

def extract_upstreams(parsed: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    upstreams = []
    
    def walk(stmts):
        for stmt in stmts:
            if stmt.get("directive") == "upstream" and "block" in stmt:
                upstreams.append({"name": stmt["args"][0] if stmt["args"] else "", "block": stmt["block"]})
            elif "block" in stmt:
                walk(stmt["block"])
                
    walk(parsed)
    return upstreams
