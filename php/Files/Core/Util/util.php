<?php

/**
 * Function which is convert the non UTF-8 string to UTF-8 string.
 *
 * @param String $str which may need to encode in UTF-8 string.
 * @return string $str utf8 encoded string.
 */
function stringToUTF8Encode($str)
{
    // mb_convert_encoding($str, "UTF-8", mb_list_encodings());
	  return $str;
}


