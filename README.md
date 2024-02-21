# ePNG
Um codificador PNG sem perdas, compacto e simples, que gera imagens RGB ou RGBA de 8 bits.

#### Exemplo de uso

    /*
    **data** é um array com as amostras da imagem no formato RGBA. Se a imagem não possuir transparência o canal alpha deve ser preenchido com o valor 255.

    **width** é a largura da inagem.

    **height** é a altura da imagem.

    **filter** é o filtro predefinido a ser aplicado à todas as scanlines. Este parâmetro aceita valores de 0 a 5. O tipo 5 é uma filtragem dinâmica conhecida como heurística da *soma mínima das diferenças absolutas*.

    O método encode() retorna um Blob contendo os dados binários da imagem, que podem ser transmitidos para o servidor o exibido na própria página.
    */
    var png = new ePNG(data, width, height, filter);
    var blob = png.encode();


