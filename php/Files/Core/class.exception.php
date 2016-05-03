<?php

namespace Files\Core;


class Exception extends \Exception
{
	/**
	 * @constructor
	 * @param string $message The error message
	 * @param int $code The error code
	 */
	public function __construct($message, $code = 0)
	{
		parent::__construct($message, $code);
	}
}