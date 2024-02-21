# ePNG
Um codificador PNG sem perdas, compacto e simples, que gera imagens RGB ou RGBA de 8 bits. Esta biblioteca não possui dependências externas.

#### Exemplo de uso

    var png = new ePNG(data, width, height, filter);
    var blob = png.encode();



**data** é um array com as amostras da imagem no formato RGBA. Se a imagem não possuir transparência o canal alpha deve ser preenchido com o valor 255.

**width** é a largura da inagem.

**height** é a altura da imagem.

**filter** é o filtro predefinido a ser aplicado à todas as scanlines. Este parâmetro aceita valores de 0 a 5. O tipo 5 é uma filtragem dinâmica conhecida como heurística da *soma mínima das diferenças absolutas*.

O método **encode()** retorna um Blob contendo os dados binários da imagem, que podem ser transmitidos para o servidor o exibido na própria página.

O codificador escolhe o
tipo de cor com base na análise do canal alpha nas amostras passadas para o construtor. Imagens com todas as amostras do canal alpha igual a 255 serão RGB, caso contrário será RGBA.
A compressão Zlib é fornecida pela Compression Streams API. Esta API Javascript conta com ampla compatibilidade nos navegadores modernos.
