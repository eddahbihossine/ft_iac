// Todo : replace json-colorizer by @pinojs/json-colorizer (fork from colorizer but use faster color lib, see https://github.com/joeattardi/json-colorizer/issues/24)
const colorizeJson = require('json-colorizer');

const colorConfig = {
    'BRACE': 'white',
    'BRACKET': 'white',
    'COLON': 'white',
    'COMMA': 'white',
    'STRING_KEY': 'green',
    'STRING_LITERAL': 'green',
    'NUMBER_LITERAL': 'yellow',
    'BOOLEAN_LITERAL': 'yellow',
    'NULL_LITERAL': 'red'
};

export function toPrettyJson(data: any) {
    return colorizeJson(data, {
        pretty: true,
        colors: colorConfig
    });
}
